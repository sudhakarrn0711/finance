// One combined endpoint for both environments. Change this URL only here.
const TRACKER_API_URL="https://script.google.com/macros/s/AKfycbyVgUtAR2a5LAKxJx4uR_Hy8MwDS5YSHDKmGcN-bsQALNY3H9lsL2xVaav3H086lOE1qg/exec";
const ENV=localStorage.getItem("trackerEnvironment")==="live"?"live":"test";
window.trackerEnvironment=ENV;
const TRACKER_ROUTES=Object.freeze({finance_tracker_new:{module:"finance"},budget:{module:"finance"},budget_other:{module:"finance",action:"getData"},budget_additional:{module:"finance",action:"getData"},category_insight:{module:"finance",action:"listTransactions"},goals:{module:"finance"},networth_tracker:{module:"finance",action:"getNetWorth"},networth_tracker_liability:{module:"finance",action:"getLiabilities"},todo:{module:"tasks"}});
window.getScriptURL=function(key){if(!Object.prototype.hasOwnProperty.call(TRACKER_ROUTES,key)){console.error("Unknown tracker route",key);return "#";}const route=TRACKER_ROUTES[key],url=new URL(TRACKER_API_URL);url.searchParams.set("env",ENV);url.searchParams.set("module",route.module);if(route.action)url.searchParams.set("action",route.action);return url.toString();};
