require('dotenv').config();

const fs = require("fs");
const { parse } = require("json2csv");

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const supa = require("@supabase/supabase-js");
const app = express();
const supaUrl = process.env.SUPABASE_KEY;
const supaAnonKey =process.env.SUPABASE_URL;
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
      const driverName = [];
      data.forEach((driver) => {
        driverName.push(
          `${driver.forename} ${driver.surname} ${driver.driverId}`
        );
      });
      const driverUrlFormatted = driverName.map((item) => {
        const parts = item.split(" ");
        console.log("Parts:", parts);

        const formattedParts = parts.map((part) =>
          part
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ø/g, "o")
            .replace(/\./g, "")
            .replace(/'/g, "-")
            .toLowerCase()
        );
        console.log("Formatted Parts:", formattedParts);

        const formattedName = formattedParts.slice(0, -1).join("-");
        console.log("Formatted Name:", formattedName);

        return `https://pitwall.app/drivers/${formattedName}`;
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

      const constructorName = data.map((constructor) => constructor.name);

      const constructorUrlFormatted = constructorName.map((item) => {
        const parts = item.split(" ");
        console.log("Parts:", parts);

        const formattedParts = parts.map((part) =>
          part
            .normalize("NFD")
            .replace(/[^a-zA-Z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .toLowerCase()
        );
        console.log("Formatted Parts:", formattedParts);

        const formattedName = formattedParts.join("-");
        console.log("Formatted Name:", formattedName);

        return `https://pitwall.app/teams/${formattedName}`;
      });

      res.json(constructorUrlFormatted);
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

    const driverNames = await axios.get("http://localhost:5050/api/drivers");
    
    const constructorNames = await axios.get(
      "http://localhost:5050/api/constructors"
    );

    const driverUrls = driverNames.data;
    const constructorUrls = constructorNames.data;

    for (const driverUrl of driverUrls) {
      const imageUrls = await getImageUrls(driverUrl, driverUrl.driverId);
      allImageUrls.push(...imageUrls);
      console.log("processing driver url");
    }

    for (const constructorUrl of constructorUrls) {
      const imageUrls = await getImageUrls(
        constructorUrl,
        constructorUrl.constructorId
      );
      allImageUrls.push(...imageUrls);
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
    $("img").each((index, element) => {
      const imageUrl = $(element).attr("src");
      if (imageUrl) {
        imageUrls.push({ imageUrl: imageUrl, id: id });
      }
    });

    return imageUrls;
  } catch (error) {
    console.error(`Error fetching images from ${url}:`, error);
    return [];
  }
}
