const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const mysql = require('mysql');
const util = require('util');


const app = express();
const port = 3000;

let browser;

async function initBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

app.use(express.json());

app.use(cors());

app.get('/getMovie', async (req, res) => {
    const name = req.query.name;


    if (!name) {
        return res.status(400).send({ 'error': 'Missing movie name parameter' });
    }

    try {
        console.log(" ");
        console.log(" ");
        console.log("---------------- " + new Date() + " ----------------");
        console.log("");
        console.log("Searching for: " + name);

        console.log("Nothing found in DB. Trying web scrape to get URL.");


        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("New page created");

        await page.goto(`https://prehrajto.cz/hledej/${name}`, { waitUntil: 'domcontentloaded' });
        console.log("Search page loaded");

        const videoUrl = await page.evaluate(() => {
            const videoElements = document.querySelectorAll('.video--small');
            return videoElements.length > 0 ? videoElements[0].href : null;
        });


        if (videoUrl) {
            await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });
            console.log("Video page loaded");
            await page.waitForSelector('video', { timeout: 20000 });

            const videoSrc = await page.evaluate(async () => {

                let videoElement = document.getElementById('content_video_html5_api');
                if (videoElement) {
                    console.log("Found content_video_html5_api");
                    return videoElement.src;
                }
                videoElement = document.querySelector('.jw-video');
                if (videoElement) {
                    console.log("Found jw-video");
                    return videoElement.src;
                }
                console.log("No video element found");
                return null;
            });

            await page.close();

            if (videoSrc) {
                res.send({ videoSrc });
                console.log("Found! Video source: " + videoSrc);
            } else {
                res.status(404).send('Video source not found');
            }
        } else {
            await page.close();
            res.status(500).send({ 'error': 'No movies found' });
        }

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while fetching the movie details');
    }
});

app.get('/', (req, res) => {
    res.send({ "status": "OK" });
});

// Start the server
app.listen(port, async () => {
    console.log(`Server running at http://localhost:${port}`);
    await initBrowser();
});
