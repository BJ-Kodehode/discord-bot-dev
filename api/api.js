const { fetch } = require('undici'); // Bruker undici sin fetch i stedet for node-fetch
const fs = require('fs');
const { TIME_API_URL, ALT_TIME_API, HOLIDAY_API_URL, HOLIDAY_FILE } = require('../config/config');

/**
 * Henter data fra en URL med automatisk retry ved feil.
 * @param {string} url - API-endepunktet som skal kalles.
 * @param {number} retries - Antall ganger det skal forsøkes på nytt ved feil.
 * @param {number} delay - Ventetid i millisekunder mellom forsøk.
 * @returns {Promise<object|null>} - Returnerer JSON-data eller null hvis alle forsøk feiler.
 */
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP feil: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Feil ved henting av data (forsøk ${attempt + 1}):`, error);
            if (attempt < retries - 1) await new Promise(res => setTimeout(res, delay));
        }
    }
    return null;
}

async function getCurrentOsloTime() {
    let data = await fetchWithRetry(TIME_API_URL);
    if (!data) {
        console.warn("Time API feilet, bytter til WorldTimeAPI...");
        data = await fetchWithRetry(ALT_TIME_API);
        if (!data) {
            console.error("Kunne ikke hente tid fra noen API-er.");
            return null;
        }
        return { date: data.datetime.split("T")[0], time: data.datetime.split("T")[1].substring(0, 8) };
    }
    return data;
}

async function fetchAndStoreHolidays() {
    try {
        const currentYear = new Date().getFullYear();
        if (fs.existsSync(HOLIDAY_FILE)) {
            const fileData = JSON.parse(fs.readFileSync(HOLIDAY_FILE, "utf8"));
            if (fileData.year === currentYear) {
                console.log("Helligdager er allerede oppdatert for dette året.");
                return fileData.dates;
            }
        }
        const response = await fetch(`${HOLIDAY_API_URL}/${currentYear}/NO`);
        let holidays;
        try {
            holidays = await response.json();
        } catch (jsonError) {
            console.error("Kunne ikke parse helligdager fra API, tom eller ugyldig JSON.");
            holidays = [];
        }
        if (!Array.isArray(holidays) || holidays.length === 0) {
            console.error("Ingen helligdager funnet i API-responsen.");
            return [];
        }
        const holidayDates = holidays.map(holiday => holiday.date);
        fs.writeFileSync(HOLIDAY_FILE, JSON.stringify({ year: currentYear, dates: holidayDates }, null, 2));
        console.log("Helligdager oppdatert og lagret.");
        return holidayDates;
    } catch (error) {
        console.error("Feil ved henting av helligdager:", error);
        return [];
    }
}

async function isNonWorkingDay() {
    try {
        const osloTime = await getCurrentOsloTime();
        if (!osloTime) return true;
        const today = osloTime.date;
        const dayOfWeek = osloTime.dayOfWeek;
        if (dayOfWeek === "Saturday" || dayOfWeek === "Sunday") {
            console.log("Det er helg, ingen varsling sendes.");
            return true;
        }
        if (today.endsWith("-12-24")) {
            console.log("Det er 24. desember, ingen varsling sendes.");
            return true;
        }
        const holidays = await fetchAndStoreHolidays();
        if (holidays.includes(today)) {
            console.log("Det er en helligdag, ingen varsling sendes.");
            return true;
        }
        return false;
    } catch (error) {
        console.error("Feil ved sjekk av arbeidsdag:", error);
        return true;
    }
}

module.exports = { getCurrentOsloTime, fetchAndStoreHolidays, isNonWorkingDay };
