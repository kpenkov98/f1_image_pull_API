require("dotenv").config();

const fs = require("fs");
const { parse } = require("json2csv");

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const supa = require("@supabase/supabase-js");
const app = express();
const supaUrl = "https://wejrcsaojijlxfrtoija.supabase.co";
const supaAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlanJjc2FvamlqbHhmcnRvaWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg3OTYzNzksImV4cCI6MjAyNDM3MjM3OX0.CRlRnblyCpynZQ4pZJ2kp8TFlxhgJU35LFW5HtsEZmM";
const supabase = supa.createClient(supaUrl, supaAnonKey);

app.listen(5050, () => {
  console.log("listening on port 5050");
});

app.get("/api/drivers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("drivers")
      .select(`forename, surname, driverId`);
    if (error) {
      res.status(500).send({ error: "Internal Server Error" });
    } else if (data && data.length > 0) {
      const driverUrlFormatted = data.map((driver) => {
        const { forename, surname, driverId } = driver;
        const parts = `${forename} ${surname} ${driverId}`.split(" ");

        const formattedParts = parts.map((part) =>
          part
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ø/g, "o")
            .replace(/\./g, "")
            .replace(/'/g, "-")
            .toLowerCase()
        );

        const formattedName = formattedParts.slice(0, -1).join("-");
        const formattedUrl = `https://pitwall.app/drivers/${formattedName}`;
        return { url: formattedUrl, id: driver.driverId };
      });

      res.json(driverUrlFormatted);
    } else {
      res.status(404).send({ error: "Not found" });
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.get("/api/constructors", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("constructors")
      .select(`name, constructorId`);
    if (error) {
      res.status(500).send({ error: "Internal Server Error" });
    } else if (data && data.length > 0) {
      const constructorUrls = data.map((constructor) => {
        const parts = constructor.name.split(" ");
        const formattedParts = parts.map((part) =>
          part
            .normalize("NFD")
            .replace(/[^a-zA-Z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .toLowerCase()
        );
        const formattedName = formattedParts.join("-");
        const formattedUrl = `https://pitwall.app/teams/${formattedName}`;
        return { url: formattedUrl, id: constructor.constructorId };
      });

      res.json(constructorUrls);
    } else {
      res.status(404).send({ error: "Not found" });
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.get("/api/get-images", async (req, res) => {
  console.log("getting images");
  try {
    const allImageUrls = [];

    const driverNamesResponse = await axios.get(
      "http://localhost:5050/api/drivers"
    );
    const constructorNamesResponse = await axios.get(
      "http://localhost:5050/api/constructors"
    );

    const driverUrls = driverNamesResponse.data.map((driver) => ({
      url: driver.url,
      id: driver.id,
    }));

    const constructorUrls = constructorNamesResponse.data.map(
      (constructor) => ({
        url: constructor.url,
        id: constructor.id,
      })
    );
    console.log(driverUrls);
    console.log(constructorUrls);

    for (const driverUrl of driverUrls) {
      const imageUrls = await getImageUrls(driverUrl.url, driverUrl.id);
      allImageUrls.push(...imageUrls);
      console.log(driverUrl.id);
      console.log("processing driver url");
    }

    for (const constructorUrl of constructorUrls) {
      const imageUrls = await getImageUrls(
        constructorUrl.url,
        constructorUrl.id
      );
      allImageUrls.push(...imageUrls);
      console.log(constructorUrl.id);
      console.log("processing constructor url");
    }

    console.log("done parsing images");

    const csv = parse(allImageUrls);

    console.log("creating a csv");

    const fileName = "imageUrls.csv";
    fs.writeFileSync(fileName, csv, "utf-8");

    res.json({ message: `CSV file with image URLs created: ${fileName}` });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getImageUrls(url, id) {
  try {
    const response = await axios.get(url);
    const html = response.data;

    const $ = cheerio.load(html);

    const imageUrls = [];
    $("body main img").each((index, element) => {
      const imageUrl = $(element).attr("src");
      if (imageUrl) {
        imageUrls.push({ imageUrl: imageUrl, id: id });
      }
        else {
          imageUrls.push({ imageUrl: "https://www.svgrepo.com/show/508699/landscape-placeholder.svg", id: id });
        }
    });

    return imageUrls;
  } catch (error) {
    console.error(`Error fetching images from ${url}:`, error);
    return [];
  }
}
