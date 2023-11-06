import { City } from "country-state-city";
import fs from "fs/promises";
import { find } from "geo-tz";

const extractChargerInfo = (data) => {
  const {
    reverse_geocoded_address_components,
    stations,
    score,
    reviews,
    url,
    name,
  } = data;

  const street =
    reverse_geocoded_address_components?.street_number +
      " " +
      reverse_geocoded_address_components?.route || "";
  const city = reverse_geocoded_address_components?.locality || "";
  const state =
    reverse_geocoded_address_components?.administrative_area_1 || "";
  const suburb = reverse_geocoded_address_components?.sublocality_1 || "";
  const postcode = reverse_geocoded_address_components?.postal_code || "";

  const chargerPlugType = stations.map((station) =>
    station.outlets.map((outlet) => outlet.connector_name).join(", ")
  );

  const totalChargers = stations.length;

  const chargeSpeed = stations
    .map((station) => station.outlets[0].kilowatts)
    .filter((speed) => speed !== null && speed !== "")
    .join(", ");

  const installationDate = stations
    .map((station) => station.created_at)
    .join(", ");

  const plugshareScore = score;

  const latestComments = reviews.map((review) => {
    return {
      comment: review.comment,
      rating: review.rating,
    };
  });
  const networkName =
    stations
      .map((station) => station?.network?.name)
      .filter((name) => name !== null && name !== "")?.[0] || "";
  const manufacturer = stations
    .map((station) => station.manufacturer)
    .filter((name) => name !== null && name !== "")
    .join(", ");
  return {
    street,
    city,
    state,
    suburb,
    postcode,
    chargerPlugType,
    totalChargers,
    chargeSpeed,
    installationDate,
    plugshareScore,
    latestComments,
    url,
    name,
    networkName,
    manufacturer,
  };
};

const checkIfLocationInAustralia = (lat, lon) => {
  return find(lat, lon)[0].split("/")[0] === "Australia";
};
const cities = City.getCitiesOfCountry("AU");

const uniqueChargingStations = [];
const getCharingStationInfo = async (id) => {
  const res = await fetch(`https://www.plugshare.com/api/locations/${id}`, {
    method: "GET",
    headers: {
      authorization: "Basic d2ViX3YyOkVOanNuUE54NHhXeHVkODU=",
      accept: "application/json, text/plain, */*",
    },
  });
  return await res.json();
};

const getEVChargingStationByLocation = async (query) => {
  const res = await fetch(
    `https://api.plugshare.com/v3/locations/region?access=1,2&count=500&latitude=${query.latitude}&longitude=${query.longitude}&minimal=0&outlets=%5B%7B%22connector%22:6,%22power%22:1%7D,%7B%22connector%22:13,%22power%22:0%7D,%7B%22connector%22:3,%22power%22:0%7D,%7B%22connector%22:2,%22power%22:0%7D,%7B%22connector%22:6,%22power%22:0%7D,%7B%22connector%22:4,%22power%22:0%7D,%7B%22connector%22:5,%22power%22:0%7D,%7B%22connector%22:25,%22power%22:0%7D,%7B%22connector%22:1,%22power%22:0%7D%5D&spanLat=14&spanLng=34`,
    {
      method: "GET",
      headers: {
        authorization: "Basic d2ViX3YyOkVOanNuUE54NHhXeHVkODU=",
        accept: "application/json, text/plain, */*",
      },
    }
  );
  const json = await res.json();
  return json;
};

async function getAllChargingStations() {
  for (const [index, city] of cities.entries()) {
    console.log(
      `Scraping urls of station for city ${city.name} - ${index + 1}/${
        cities.length
      }`
    );
    const chargingStations = await getEVChargingStationByLocation(city);
    uniqueChargingStations.push(...chargingStations);
  }

  // Filter unique charging stations based on some criteria
  const uniqueArray = removeDuplicates(uniqueChargingStations, "url").filter(
    (el) => checkIfLocationInAustralia(el.latitude, el.longitude)
  );

  // Do something with the unique array of charging stations

  return uniqueArray;
}

// Function to remove duplicates from an array based on a unique identifier
function removeDuplicates(array, identifier) {
  const uniqueSet = new Set();
  const result = [];

  for (const item of array) {
    if (!uniqueSet.has(item[identifier])) {
      uniqueSet.add(item[identifier]);
      result.push(item);
    }
  }

  return result;
}

// Call the function to get all charging stations
const allChargingStation = await getAllChargingStations();
const allChargingStationInfo = [];
for (let index = 0; index < allChargingStation.length; index++) {
  console.log(
    `Scraping charing station info ${index + 1}/${allChargingStation.length}`
  );
  const chargingStation = allChargingStation[index];
  const info = await getCharingStationInfo(
    chargingStation.url.split("/").pop()
  );
  allChargingStationInfo.push(extractChargerInfo(info));
}
await fs.writeFile(`./data.csv`, jsonToCsv(allChargingStationInfo));

function jsonToCsv(data) {
  const csvHeaders = [
    "Street",
    "Suburb",
    "State",
    "Postcode",
    "Charger Plug Type",
    "Total Chargers",
    "Charge Speed (kW)",
    "Installation Date",
    "Network Name",
    "Charger Manufacturer",
    "Plugshare Score",
    "Latest Comments",
    "URL",
    "Name",
  ];

  const csvRows = data.map((station) => {
    const {
      street,
      city,
      state,
      postcode,
      chargerPlugType,
      totalChargers,
      chargeSpeed,
      installationDate,
      plugshareScore,
      latestComments,
      url,
      name,
      networkName,
      manufacturer,
    } = station;

    // Format the installationDate as needed
    const formattedInstallationDate = installationDate || "";

    // Format the chargerPlugType as a comma-separated string
    const formattedChargerPlugType = chargerPlugType.join(", ");

    // Format the latestComments as a single string
    const formattedLatestComments = latestComments
      .map(
        (comment) =>
          `${comment.comment.replace(/"/g, '""')} (Rating: ${comment.rating})`
      )
      .join(", ");

    return [
      street || "",
      city || "",
      state || "",
      postcode || "",
      formattedChargerPlugType,
      totalChargers || "",
      chargeSpeed || "",
      formattedInstallationDate,
      networkName || "",
      manufacturer || "",
      plugshareScore || "",
      formattedLatestComments,
      url || "",
      name || "",
    ];
  });

  // Combine headers and rows
  const csvData = [csvHeaders, ...csvRows];

  // Convert to CSV format
  const csvContent = csvData
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  return csvContent;
}

console.log(`Completed`);
