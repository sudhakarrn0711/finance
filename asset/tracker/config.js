// STEP 1: Environment selector
const ENV = "live"; // change to "live" when deploying

// STEP 2: URLs per environment
const CONFIG = {
  live: {
    finance_tracker_new: "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec",
    budget:              "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec",
    budget_other:        "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec?action=getData",
    budget_additional:   "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec?action=getData",
    category_insight:    "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec?action=listTransactions",
    goals:               "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec",
    networth_tracker:    "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec?action=getNetWorth",
    networth_tracker_liability:    "https://script.google.com/macros/s/AKfycbyPM-sCaNDogGAqltlTSYOSvVWdQI9XXrAaUT_oDwYHcIWDCn1xFkFX4MGYKjVdzUqf/exec?action=getLiabilities",
    todo: "https://script.google.com/macros/s/AKfycbxXTH2BrfKbvTI9EqLCJAuYqIQyIYqjxJ3w1esBx_IYReTMZv1ac0NZ5XwSnIC1XIhhcA/exec"
  },  
  
  test: {
    finance_tracker_new: "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec",
    budget:              "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec",
    budget_other:        "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec?action=getData",
    budget_additional:   "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec?action=getData",
    category_insight:    "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec?action=listTransactions",
    goals:               "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec",
    networth_tracker:    "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec?action=getNetWorth",
    networth_tracker_liability:    "https://script.google.com/macros/s/AKfycbyLxDfYb54dQsu0KcP6XsJK0GyBf4FodbJzB8tC0DlPlC3nYyB8eEiIk8fT6_WLChuE3g/exec?action=getLiabilities",
    todo: "https://script.google.com/macros/s/AKfycbyhP5KscfvCnph5F8WAibOJo2repQs5NZK4w_txHZ1ohmK4McSy2BiXRAslZY2frmVGKQ/exec"
  }
};

// ✅ Global helpers
window.getScriptURL = function (key) {
  return CONFIG[ENV][key] || "#";
};
