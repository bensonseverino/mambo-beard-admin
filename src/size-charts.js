// Product size charts — single source of truth.
//
// The admin dashboard assigns one chart (or none) to each product; the
// storefront renders the assigned chart from `GET /api/size-charts`. Charts
// are reference data, not database rows, so editing this file is the only
// change needed to add or update a chart.
//
// Every measurement is garment-side and strictly in inches:
//   • number — a single measured value
//   • "A-B"  — a range (UK/US size bands, or a body range a size fits)
//
// Values are rendered verbatim in the admin preview and the storefront table.
//
// `appliesTo` lists the product categories the chart fits. It is advisory —
// the admin can assign any chart to any product.

export const SIZE_CHARTS = [
  {
    id: "size-chart-mens-sweatpants",
    title: "Men's Sweatpants",
    unit: "inches",
    appliesTo: ["mens-sweatpants", "mens-joggers"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    measurements: {
      Waist: ["25-28", "28-31", "30-33", "32-35", "34-37", "36-39", "38-41"],
      Hips: [34, 37, 40, 44, 47, 50, 53],
      Thigh: [18, 20, 22, 24, 28, 31, 33],
      Inseam: [30, 31, 32, 33, 34, 35, 36],
      Outseam: [38, 39, 41, 41, 42, 42, 42],
    },
  },
  {
    id: "size-chart-womens-sweatpants",
    title: "Women's Sweatpants",
    unit: "inches",
    appliesTo: ["womens-sweatpants", "womens-joggers"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    measurements: {
      "UK Size": ["6-8", "8-10", "10-12", "12-14", "14-16", "16-18", "18-20"],
      "US Size": ["8-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"],
      Waist: ["25-28", "28-31", "30-33", "32-35", "34-37", "36-39", "38-41"],
      Hips: [39, 42, 46, 49, 52, 56, 60],
      Thigh: [22, 24, 26, 29, 33, 37, 40],
      Inseam: [30, 31, 32, 33, 34, 35, 36],
      Outseam: [38, 39, 40, 41, 41, 42, 42],
    },
  },
  {
    id: "size-chart-tshirts",
    title: "Standard T-Shirts",
    unit: "inches",
    appliesTo: ["t-shirts", "graphic-tees", "crewneck-tees"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    measurements: {
      "UK Size": ["4-6", "6-8", "8-10", "10-12", "12-14", "14-16", "16-18"],
      "US Size": ["8-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"],
      Length: [26, 27, 28, 29, 30, 31, 32],
      Chest: [32, 34, 36, 38, 40, 42, 44],
      "Across Shoulder": [13, 14, 15, 16, 17, 18, 19],
      "Short Sleeve Length": [5, 6, 7, 8, 9, 10, 11],
      "Long Sleeve Length": [20, 22, 24, 27, 27, 29, 30],
    },
  },
  {
    id: "size-chart-cropped-tshirts",
    title: "Cropped T-Shirts",
    unit: "inches",
    appliesTo: ["cropped-tshirts", "crop-tops"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL"],
    measurements: {
      "UK Size": ["0-2", "2-4", "6-8", "10-12", "14-16", "18-20"],
      "US Size": ["2-4", "4-6", "8-10", "12-14", "16-18", "20-22"],
      Chest: [34, 36, 38, 40, 42, 44],
      Shoulders: [13, 14, 15, 16, 17, 18],
      Sleeve: [6, 7, 8, 9, 10, 11],
      Length: [15, 16, 17, 18, 19, 20],
    },
  },
  {
    id: "size-chart-tshirt-dress",
    title: "T-Shirt Dress",
    unit: "inches",
    appliesTo: ["tshirt-dresses"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    measurements: {
      "UK Size": ["6-8", "8-10", "10-12", "12-14", "14-16", "16-18", "18-20"],
      "US Size": ["8-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"],
      "Dress Length": [31, 32, 33, 34, 35, 36, 37],
      Chest: [34, 36, 38, 40, 42, 44, 46],
      "Across Shoulder": [13, 14, 15, 16, 17, 18, 19],
    },
  },
  {
    id: "size-chart-hoodies",
    title: "Hoodies",
    unit: "inches",
    appliesTo: ["hoodies", "pullovers", "zip-hoodies"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    measurements: {
      "UK Size": ["6-8", "8-10", "10-12", "12-14", "14-16", "16-18", "18-20"],
      "US Size": ["8-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"],
      Length: [26, 27, 28, 29, 30, 31, 32],
      Chest: [36, 38, 40, 44, 46, 48, 50],
      "Across Shoulder": [16, 17, 18, 19, 20, 21, 22],
      Sleeve: [21.5, 22.5, 24, 26, 27, 28, 28],
    },
  },
  {
    id: "size-chart-college-jackets",
    title: "College Jackets",
    unit: "inches",
    appliesTo: ["college-jackets", "varsity-jackets", "bomber-jackets"],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    measurements: {
      "UK Size": ["6-8", "8-10", "10-12", "12-14", "14-16", "16-18", "18-20"],
      "US Size": ["8-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"],
      "Body Length": [26, 27, 28, 29, 30, 31, 32],
      Chest: [36, 38, 40, 44, 46, 48, 50],
      "Across Shoulder": [16, 17, 18, 19, 20, 21, 22],
      Sleeve: [21.5, 22.5, 24, 26, 27, 28, 28],
    },
  },
];

/** Look up one chart by id (null when the id is unknown). */
export const getSizeChart = (chartId) =>
  SIZE_CHARTS.find((chart) => chart.id === chartId) || null;

/** The safe subset of chart data to expose through the public API. */
export const toPublicChart = (chart) => ({
  id: chart.id,
  title: chart.title,
  unit: chart.unit,
  appliesTo: chart.appliesTo,
  sizes: chart.sizes,
  measurements: chart.measurements,
});

export const listPublicSizeCharts = () => SIZE_CHARTS.map(toPublicChart);
