const DATA_URL =
  "./data/OECD.ENV.EPI,DSD_AIR_GHG@DF_AIR_GHG,+.A.GHG._T.KG_CO2E_PS.csv";
const START_YEAR = 2014;
const END_YEAR = 2021;
const TARGET_MEASURE = "_T";
const TARGET_UNIT = "KG_CO2E_PS";

const selectedCountriesWhite = [
  "USA",
  "CAN",
  "AUS",
  "DEU",
  "FRA",
  "GBR",
  "JPN",
  "KOR",
  "CHE",
  "CHL",
  "MEX",
  "CRI",
  "KAZ",
];
const selectedCountriesBlack = ["USA", "CAN", "AUS", "KAZ"];

const tooltip = d3.select("#tooltip");

function init() {
  loadData();
}

function loadData() {
  d3.csv(DATA_URL)
    .then((data) => {
      const timeParser = d3.timeParse("%Y");

      const filteredData = data
        .filter((d) => {
          const year = +d.TIME_PERIOD;
          return (
            year >= START_YEAR &&
            year <= END_YEAR &&
            d.MEASURE === TARGET_MEASURE &&
            d.UNIT_MEASURE === TARGET_UNIT &&
            d.REF_AREA
          );
        })
        .map((d) => {
          const rawValue = parseFloat(d.OBS_VALUE);
          const year = timeParser(d.TIME_PERIOD);
          if (!year) {
            return null;
          }
          return {
            countryCode: d.REF_AREA,
            countryName: d["Reference area"] || d.REF_AREA,
            year: year,
            yearNum: +d.TIME_PERIOD,
            rawValue: isNaN(rawValue) ? 0 : rawValue,
            actualValue: isNaN(rawValue) ? 0 : rawValue * 1000,
            status: d.OBS_STATUS,
          };
        })
        .filter((d) => d !== null);

      const dataGroupedWhite = d3.group(
        filteredData.filter((d) =>
          selectedCountriesWhite.includes(d.countryCode)
        ),
        (d) => d.countryName
      );
      dataGroupedWhite.forEach((group) =>
        group.sort((a, b) => a.year - b.year)
      );

      const dataBlackRaw = filteredData.filter((d) =>
        selectedCountriesBlack.includes(d.countryCode)
      );
      const dataPivotedBlack = Array.from(
        d3.group(dataBlackRaw, (d) => d.yearNum)
      )
        .map(([yearNum, values]) => {
          const obj = { year: values[0].year, yearNum: yearNum };
          selectedCountriesBlack.forEach((countryCode) => {
            const entry = values.find((d) => d.countryCode === countryCode);
            obj[countryCode] = entry ? entry.rawValue : 0;
          });
          return obj;
        })
        .sort((a, b) => a.year - b.year);

      if (dataGroupedWhite.size > 0) {
        createWhiteHatChart(dataGroupedWhite);
      } else {
        console.error("No data found for White Hat selection");
        d3.select("#white-hat-vis").html(
          "<p>Error: No data available for the White Hat selection.</p>"
        );
      }

      if (dataPivotedBlack.length > 0) {
        createBlackHatChart(dataPivotedBlack);
      } else {
        console.error("No data found for Black Hat selection");
        d3.select("#black-hat-vis").html(
          "<p>Error: No data available for the Black Hat selection.</p>"
        );
      }
    })
    .catch((error) => {
      console.error("Error loading or processing data:", error);
      d3.select(".container")
        .insert("p", ":first-child")
        .style("color", "red")
        .style("font-weight", "bold")
        .text(
          `Failed to load data from ${DATA_URL}. Please check file path and server.`
        );
    });
}

const showTooltip = (event, content) => {
  tooltip
    .html(content)
    .style("left", event.pageX + 15 + "px")
    .style("top", event.pageY - 10 + "px")
    .classed("visible", true);
};
const hideTooltip = () => {
  tooltip.classed("visible", false);
};

function createWhiteHatChart(dataGrouped) {
  const container = d3.select("#white-hat-vis");
  const legendContainer = container.append("div").attr("class", "legend");

  let maxY = 0;
  dataGrouped.forEach((countryData) => {
    const countryMax = d3.max(countryData, (d) => d.actualValue);
    if (countryMax > maxY) maxY = countryMax;
  });
  const yDomain = [0, maxY * 1.05];

  const timeDomain = d3.extent(
    Array.from(dataGrouped.values())[0],
    (d) => d.year
  );

  const marginWH = { top: 20, right: 30, bottom: 40, left: 60 };
  const visWidthWH = 800;
  const visHeightWH = 450;
  const widthWH = visWidthWH - marginWH.left - marginWH.right;
  const heightWH = visHeightWH - marginWH.top - marginWH.bottom;

  const svg = container
    .append("svg")
    .attr("width", visWidthWH)
    .attr("height", visHeightWH)
    .append("g")
    .attr("transform", `translate(${marginWH.left},${marginWH.top})`);

  const x = d3.scaleTime().domain(timeDomain).range([0, widthWH]);
  const y = d3.scaleLinear().domain(yDomain).range([heightWH, 0]).nice();

  const countryNames = Array.from(dataGrouped.keys());
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(countryNames);

  const xAxis = d3
    .axisBottom(x)
    .ticks(d3.timeYear.every(1))
    .tickFormat(d3.timeFormat("%Y"));
  svg
    .append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${heightWH})`)
    .call(xAxis);

  const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s"));
  svg.append("g").attr("class", "axis y-axis").call(yAxis);

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("x", widthWH / 2)
    .attr("y", heightWH + marginWH.bottom - 5)
    .text("Year");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("y", -marginWH.left + 15)
    .attr("x", -heightWH / 2)
    .text("Kg CO2e per Person");

  const line = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.actualValue));

  const path = svg
    .selectAll(".line")
    .data(dataGrouped)
    .join("path")
    .attr("class", "line")
    .style("stroke", (d) => color(d[0]))
    .attr("d", (d) => line(d[1]));

  const focus = svg.append("g").attr("class", "focus").style("display", "none");

  focus
    .append("line")
    .attr("class", "hover-line")
    .attr("y1", 0)
    .attr("y2", heightWH);

  svg
    .append("rect")
    .attr("class", "overlay")
    .attr("width", widthWH)
    .attr("height", heightWH)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("mouseover", () => {
      focus.style("display", null);
      tooltip.classed("visible", true);
      path.classed("fade", true);
    })
    .on("mouseout", () => {
      focus.style("display", "none");
      tooltip.classed("visible", false);
      path.classed("highlight", false).classed("fade", false);
    })
    .on("mousemove", mousemoveHandler);

  function mousemoveHandler(event) {
    const pointer = d3.pointer(event);
    const x0 = x.invert(pointer[0]);
    const bisectDate = d3.bisector((d) => d.year).left;

    let tooltipContent = `<div style="font-weight: bold;">${d3.timeFormat("%Y")(
      x0
    )}</div>`;
    let closestPoints = [];

    dataGrouped.forEach((values, key) => {
      const i = bisectDate(values, x0, 1);
      const d0 = values[i - 1];
      const d1 = values[i];
      const d = d1 && x0 - d0.year > d1.year - x0 ? d1 : d0;
      if (d)
        closestPoints.push({
          country: key,
          value: d.actualValue,
          year: d.year,
          color: color(key),
        });
    });

    closestPoints.sort((a, b) => b.value - a.value);

    let minDist = Infinity;
    let closestCountry = null;
    if (closestPoints.length > 0) {
      const y0 = y.invert(pointer[1]);
      closestPoints.forEach((p) => {
        const dist = Math.abs(p.value - y0);
        if (dist < minDist) {
          minDist = dist;
          closestCountry = p.country;
        }
      });
    }

    path
      .classed("highlight", (d) => d[0] === closestCountry)
      .classed("fade", (d) => d[0] !== closestCountry);

    closestPoints.forEach((p) => {
      tooltipContent += `
                <div style="color: ${p.color}; ${
        p.country === closestCountry ? "font-weight: bold;" : ""
      }">
                  ${p.country}: ${d3.format(",.1f")(p.value)}
                </div>`;
    });

    const closestYearOverall =
      closestPoints.length > 0 ? closestPoints[0].year : x0;
    focus
      .select(".hover-line")
      .attr("transform", `translate(${x(closestYearOverall)},0)`);

    showTooltip(event, tooltipContent);
  }

  const legendItems = legendContainer
    .selectAll(".legend-item")
    .data(countryNames)
    .join("div")
    .attr("class", "legend-item");

  legendItems
    .append("span")
    .attr("class", "legend-color-box")
    .style("background-color", (d) => color(d));

  legendItems
    .append("span")
    .attr("class", "legend-text")
    .text((d) => d);
}

function createBlackHatChart(dataPivoted) {
  const container = d3.select("#black-hat-vis");
  const legendContainer = container.append("div").attr("class", "legend");

  const color = d3
    .scaleOrdinal()
    .domain(selectedCountriesBlack)
    .range(d3.schemeTableau10);

  const stack = d3.stack().keys(selectedCountriesBlack).offset(d3.stackOffsetNone);

  const series = stack(dataPivoted);

  const visWidthBH = 700;
  const visHeightBH = 400;
  const marginBH = { top: 20, right: 30, bottom: 50, left: 60 };
  const widthBH = visWidthBH - marginBH.left - marginBH.right;
  const heightBH = visHeightBH - marginBH.top - marginBH.bottom;

  const svg = d3
    .select("#black-hat-vis")
    .append("svg")
    .attr("width", visWidthBH)
    .attr("height", visHeightBH)
    .append("g")
    .attr("transform", `translate(${marginBH.left},${marginBH.top})`);

  const x = d3
    .scaleTime()
    .domain(d3.extent(dataPivoted, (d) => d.year))
    .range([0, widthBH]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(series, (d) => d3.max(d, (d) => d[1])) * 1.05])
    .range([heightBH, 0])
    .nice();

  const area = d3
    .area()
    .x((d) => x(d.data.year))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]));

  svg
    .append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${heightBH})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat("%Y"))
    );

  svg.append("g").attr("class", "axis y-axis").call(d3.axisLeft(y).ticks(5));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("x", widthBH / 2)
    .attr("y", heightBH + marginBH.bottom - 10)
    .text("Year");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("y", -marginBH.left + 15)
    .attr("x", -heightBH / 2)
    .text("Cumulative Emission Index");

  svg
    .selectAll(".area-layer")
    .data(series)
    .join("path")
    .attr("class", (d) => `area area-${d.key}`)
    .attr("fill", (d) => color(d.key))
    .attr("d", area)
    .on("mouseover", (event, d) => {
      showTooltip(event, `<strong>${d.key}</strong>`);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 10 + "px");
    })
    .on("mouseleave", hideTooltip);

    //hardcoding legend colors because it wouldnt work ;-;
  const legendData = [
    { country: "Kazakhstan", color: "#76B7B2" },
    { country: "Australia", color: "#F28E2B" },
    { country: "Canada", color: "#E15759" },
    { country: "United States", color: "#4E79A7" },
  ];

  legendData.forEach((entry) => {
    const item = legendContainer.append("div").attr("class", "legend-item");

    item
      .append("div")
      .attr("class", "legend-color")
      .style("background-color", entry.color)
      .style("width", "16px")
      .style("height", "16px")
      .style("display", "inline-block")
      .style("margin-right", "8px");

    item.append("span").attr("class", "legend-label").text(entry.country);
  });
}

window.addEventListener("load", init);
