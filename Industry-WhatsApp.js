// industry-whatsapp.js
// Sky Blue Solution
// Industry-Specific WhatsApp Business Assistant
//
// This file contains the business logic for all 16 SaaS products.
// It is intentionally separate from worker.js and whatsapp-engine.js.
//
// The shared WhatsApp engine handles Meta/WhatsApp communication.
// This file determines WHAT WhatsApp should do for each industry.


// ============================================================
// SUPPORTED INDUSTRIES
// ============================================================

export const INDUSTRY_WHATSAPP_MODULES = {

  "community-service-centre": {
    name: "Community Service Centre",

    menu: [
      ["1", "Report a community problem"],
      ["2", "Check report status"],
      ["3", "Report electricity problem"],
      ["4", "Report water problem"],
      ["5", "Report pothole/road problem"],
      ["6", "Report illegal dumping"],
      ["7", "Report another problem"],
      ["8", "Speak to service centre"]
    ],

    workflows: {
      "1": "community_report",
      "2": "community_status",
      "3": "community_electricity",
      "4": "community_water",
      "5": "community_roads",
      "6": "community_dumping",
      "7": "community_other"
    }
  },


  // ==========================================================
  // NPO / NGO
  // ==========================================================

  "npo-ngo": {
    name: "NPO & NGO Management",

    menu: [
      ["1", "Beneficiary assistance"],
      ["2", "Volunteer information"],
      ["3", "Programme information"],
      ["4", "Donate"],
      ["5", "Request assistance"],
      ["6", "Organisation announcements"],
      ["7", "Contact the organisation"]
    ],

    workflows: {
      "1": "npo_beneficiary",
      "2": "npo_volunteer",
      "3": "npo_programme",
      "4": "npo_donation",
      "5": "npo_assistance",
      "6": "npo_announcements"
    }
  },


  // ==========================================================
  // CHURCH
  // ==========================================================

  "church-management": {
    name: "Church Management",

    menu: [
      ["1", "Submit prayer request"],
      ["2", "Prayer programme"],
      ["3", "Church services"],
      ["4", "Bible study"],
      ["5", "Church events"],
      ["6", "Join a ministry"],
      ["7", "Give / offering"],
      ["8", "Speak to church office"]
    ],

    workflows: {
      "1": "church_prayer",
      "2": "church_prayer_programme",
      "3": "church_services",
      "4": "church_bible_study",
      "5": "church_events",
      "6": "church_ministry",
      "7": "church_giving",
      "8": "church_office"
    }
  },


  // ==========================================================
  // E-COMMERCE
  // ==========================================================

  "ecommerce": {
    name: "E-Commerce & Online Store",

    menu: [
      ["1", "Browse products"],
      ["2", "Search for a product"],
      ["3", "Place an order"],
      ["4", "Check my order"],
      ["5", "Delivery information"],
      ["6", "Payment information"],
      ["7", "Speak to the store"]
    ],

    workflows: {
      "1": "ecommerce_products",
      "2": "ecommerce_search",
      "3": "ecommerce_order",
      "4": "ecommerce_order_status",
      "5": "ecommerce_delivery",
      "6": "ecommerce_payment",
      "7": "ecommerce_support"
    }
  },


  // ==========================================================
  // SALON & BARBER
  // ==========================================================

  "salon-barber": {
    name: "Salon & Barber Management",

    menu: [
      ["1", "Book an appointment"],
      ["2", "View services"],
      ["3", "Check appointment"],
      ["4", "Join waiting list"],
      ["5", "Ask about prices"],
      ["6", "View promotions"],
      ["7", "Cancel appointment"],
      ["8", "Speak to the salon"]
    ],

    workflows: {
      "1": "salon_booking",
      "2": "salon_services",
      "3": "salon_appointment",
      "4": "salon_waiting_list",
      "5": "salon_prices",
      "6": "salon_promotions",
      "7": "salon_cancel",
      "8": "salon_support"
    }
  },


  // ==========================================================
  // LAUNDRY
  // ==========================================================

  "laundry": {
    name: "Laundry Management",

    menu: [
      ["1", "Book laundry collection"],
      ["2", "Request delivery"],
      ["3", "Check laundry order"],
      ["4", "View services"],
      ["5", "Ask for a quotation"],
      ["6", "Payment information"],
      ["7", "Speak to laundry"]
    ],

    workflows: {
      "1": "laundry_collection",
      "2": "laundry_delivery",
      "3": "laundry_order",
      "4": "laundry_services",
      "5": "laundry_quote",
      "6": "laundry_payment",
      "7": "laundry_support"
    }
  },


  // ==========================================================
  // FOOD BUSINESS
  // ==========================================================

  "food-business": {
    name: "Food Business Management",

    menu: [
      ["1", "View menu"],
      ["2", "Place an order"],
      ["3", "Check my order"],
      ["4", "Collection"],
      ["5", "Delivery"],
      ["6", "Today's specials"],
      ["7", "Speak to the business"]
    ],

    workflows: {
      "1": "food_menu",
      "2": "food_order",
      "3": "food_order_status",
      "4": "food_collection",
      "5": "food_delivery",
      "6": "food_specials",
      "7": "food_support"
    }
  },


  // ==========================================================
  // WHOLESALE / GROCERY
  // ==========================================================

  "wholesale-grocery": {
    name: "Wholesale & Grocery Management",

    menu: [
      ["1", "Browse products"],
      ["2", "Request stock availability"],
      ["3", "Place wholesale order"],
      ["4", "Request quotation"],
      ["5", "Check my order"],
      ["6", "Delivery information"],
      ["7", "Payment information"],
      ["8", "Speak to sales"]
    ],

    workflows: {
      "1": "wholesale_products",
      "2": "wholesale_stock",
      "3": "wholesale_order",
      "4": "wholesale_quote",
      "5": "wholesale_order_status",
      "6": "wholesale_delivery",
      "7": "wholesale_payment",
      "8": "wholesale_sales"
    }
  },


  // ==========================================================
  // DRIVING SCHOOL
  // ==========================================================

  "driving-school": {
    name: "Driving School Management",

    menu: [
      ["1", "Register as learner"],
      ["2", "Book a driving lesson"],
      ["3", "Check my lesson"],
      ["4", "Instructor information"],
      ["5", "Test information"],
      ["6", "Payment information"],
      ["7", "Speak to driving school"]
    ],

    workflows: {
      "1": "driving_register",
      "2": "driving_lesson",
      "3": "driving_lesson_status",
      "4": "driving_instructor",
      "5": "driving_test",
      "6": "driving_payment",
      "7": "driving_support"
    }
  },


  // ==========================================================
  // SCHOOL
  // ==========================================================

  "school-management": {
    name: "School Management",

    menu: [
      ["1", "Parent information"],
      ["2", "Learner attendance"],
      ["3", "School announcements"],
      ["4", "School calendar"],
      ["5", "Fees information"],
      ["6", "Contact teacher"],
      ["7", "Contact school office"]
    ],

    workflows: {
      "1": "school_parent",
      "2": "school_attendance",
      "3": "school_announcements",
      "4": "school_calendar",
      "5": "school_fees",
      "6": "school_teacher",
      "7": "school_office"
    }
  },


  // ==========================================================
  // PRESCHOOL / DAYCARE
  // ==========================================================

  "preschool-daycare": {
    name: "Preschool & Day-care Management",

    menu: [
      ["1", "Child information"],
      ["2", "Attendance"],
      ["3", "Pickup information"],
      ["4", "Daily activities"],
      ["5", "Fees information"],
      ["6", "Announcements"],
      ["7", "Speak to daycare"]
    ],

    workflows: {
      "1": "daycare_child",
      "2": "daycare_attendance",
      "3": "daycare_pickup",
      "4": "daycare_activities",
      "5": "daycare_fees",
      "6": "daycare_announcements",
      "7": "daycare_support"
    }
  },


  // ==========================================================
  // PHARMACY
  // ==========================================================

  "pharmacy": {
    name: "Pharmacy Management",

    menu: [
      ["1", "Check product availability"],
      ["2", "Request stock"],
      ["3", "Report low stock"],
      ["4", "Daily pharmacy report"],
      ["5", "Request branch transfer"],
      ["6", "Report damaged/expired stock"],
      ["7", "Check stock request"],
      ["8", "Contact head office"]
    ],

    workflows: {
      "1": "pharmacy_stock",
      "2": "pharmacy_stock_request",
      "3": "pharmacy_low_stock",
      "4": "pharmacy_daily_report",
      "5": "pharmacy_transfer",
      "6": "pharmacy_damaged_stock",
      "7": "pharmacy_request_status",
      "8": "pharmacy_head_office"
    }
  },


  // ==========================================================
  // TRANSPORT
  // ==========================================================

  "transport": {
    name: "Transport Management",

    menu: [
      ["1", "Make a booking"],
      ["2", "Check booking"],
      ["3", "Trip information"],
      ["4", "Driver information"],
      ["5", "Request quotation"],
      ["6", "Payment information"],
      ["7", "Contact transport office"]
    ],

    workflows: {
      "1": "transport_booking",
      "2": "transport_booking_status",
      "3": "transport_trip",
      "4": "transport_driver",
      "5": "transport_quote",
      "6": "transport_payment",
      "7": "transport_support"
    }
  },


  // ==========================================================
  // IT BUSINESS
  // ==========================================================

  "it-business": {
    name: "IT Business Management",

    menu: [
      ["1", "Request IT support"],
      ["2", "Check support ticket"],
      ["3", "Request quotation"],
      ["4", "Request service"],
      ["5", "Invoice information"],
      ["6", "Report a problem"],
      ["7", "Speak to technician"]
    ],

    workflows: {
      "1": "it_ticket",
      "2": "it_ticket_status",
      "3": "it_quote",
      "4": "it_service",
      "5": "it_invoice",
      "6": "it_problem",
      "7": "it_support"
    }
  },


  // ==========================================================
  // BUILDING MATERIALS
  // ==========================================================

  "building-materials": {
    name: "Building Materials Management",

    menu: [
      ["1", "Check product availability"],
      ["2", "Request quotation"],
      ["3", "Place an order"],
      ["4", "Check order"],
      ["5", "Delivery information"],
      ["6", "Payment information"],
      ["7", "Speak to sales"]
    ],

    workflows: {
      "1": "building_stock",
      "2": "building_quote",
      "3": "building_order",
      "4": "building_order_status",
      "5": "building_delivery",
      "6": "building_payment",
      "7": "building_sales"
    }
  },


  // ==========================================================
  // OTHER SERVICES
  // ==========================================================

  "other-services": {
    name: "Other Service Businesses",

    menu: [
      ["1", "Request a service"],
      ["2", "Book a service"],
      ["3", "Request quotation"],
      ["4", "Check my job"],
      ["5", "Invoice information"],
      ["6", "Payment information"],
      ["7", "Speak to the business"]
    ],

    workflows: {
      "1": "service_request",
      "2": "service_booking",
      "3": "service_quote",
      "4": "service_job_status",
      "5": "service_invoice",
      "6": "service_payment",
      "7": "service_support"
    }
  }

};


// ============================================================
// GET INDUSTRY CONFIGURATION
// ============================================================

export function getIndustryWhatsAppConfig(
  moduleCode
) {

  const config =
    INDUSTRY_WHATSAPP_MODULES[
      String(moduleCode || "").trim()
    ];

  if (config) {
    return config;
  }

  return INDUSTRY_WHATSAPP_MODULES[
    "other-services"
  ];
}


// ============================================================
// GET INDUSTRY MENU
// ============================================================

export function getIndustryWhatsAppMenu(
  moduleCode
) {

  const config =
    getIndustryWhatsAppConfig(
      moduleCode
    );

  return config.menu.map(
    ([number, label]) => ({
      number,
      label
    })
  );
}


// ============================================================
// BUILD WHATSAPP WELCOME
// ============================================================

export function buildIndustryWhatsAppWelcome(
  moduleCode,
  businessName = null
) {

  const config =
    getIndustryWhatsAppConfig(
      moduleCode
    );

  const title =
    businessName
      ? businessName
      : config.name;

  let message =
    `Welcome to ${title}.\n\n`;

  message +=
    `I'm your WhatsApp Business Assistant.\n\n`;

  message +=
    `Please choose an option:\n\n`;

  for (
    const [number, label]
    of config.menu
  ) {

    message +=
      `${number}️⃣ ${label}\n`;
  }

  message +=
    `\nReply with the number of your choice.`;

  return message;
}


// ============================================================
// BUILD WORKFLOW START MESSAGE
// ============================================================

export function buildIndustryWorkflowStart(
  moduleCode,
  workflowCode
) {

  const config =
    getIndustryWhatsAppConfig(
      moduleCode
    );

  const messages = {

    // --------------------------------------------------------
    // SALON
    // --------------------------------------------------------

    salon_booking:
      "💇 Appointment Booking\n\nPlease enter the service you would like to book.",

    salon_services:
      "💇 Our available salon services will be displayed here.",

    salon_appointment:
      "Please enter your name or appointment reference so I can find your booking.",

    salon_waiting_list:
      "Please enter your name. We will add you to the salon waiting list.",

    salon_prices:
      "Please tell me which salon service you would like the price for.",

    salon_promotions:
      "Here are the current salon promotions available.",

    salon_cancel:
      "Please enter your appointment reference to request cancellation.",

    salon_support:
      "Please describe what you need help with and the salon team will assist you.",


    // --------------------------------------------------------
    // CHURCH
    // --------------------------------------------------------

    church_prayer:
      "🙏 Prayer Request\n\nPlease enter your prayer request. Your request will be recorded for the church prayer team.",

    church_prayer_programme:
      "🙏 Prayer Programme\n\nThe church prayer programme will be displayed here.",

    church_services:
      "⛪ Church Services\n\nOur service schedule will be displayed here.",

    church_bible_study:
      "📖 Bible Study\n\nOur Bible study schedule and information will be displayed here.",

    church_events:
      "📅 Church Events\n\nOur upcoming church programmes and events will be displayed here.",

    church_ministry:
      "Please tell us which ministry you would like to join.",

    church_giving:
      "Please select the giving method or enter your giving enquiry.",

    church_office:
      "Please type your message for the church office.",


    // --------------------------------------------------------
    // PHARMACY
    // --------------------------------------------------------

    pharmacy_stock:
      "💊 Stock Availability\n\nEnter the product name you want to check.",

    pharmacy_stock_request:
      "📦 Stock Request\n\nEnter the product name and quantity required.\n\nExample:\nParacetamol 500mg - 50 units",

    pharmacy_low_stock:
      "⚠️ Low Stock Report\n\nEnter the product name and current quantity.",

    pharmacy_daily_report:
      "📊 Daily Pharmacy Report\n\nPlease enter today's report information.",

    pharmacy_transfer:
      "🔄 Branch Stock Transfer\n\nEnter the product, quantity and branch you are requesting the stock from.",

    pharmacy_damaged_stock:
      "⚠️ Damaged / Expired Stock\n\nEnter the product name, quantity and reason.",

    pharmacy_request_status:
      "Please enter your stock request reference number.",

    pharmacy_head_office:
      "🏢 Head Office\n\nPlease type your message for Head Office.",


    // --------------------------------------------------------
    // E-COMMERCE
    // --------------------------------------------------------

    ecommerce_products:
      "🛒 Products\n\nPlease enter the product or category you are looking for.",

    ecommerce_search:
      "🔎 Product Search\n\nEnter the product name.",

    ecommerce_order:
      "🛍️ Order\n\nPlease enter the product(s) and quantity you would like to order.",

    ecommerce_order_status:
      "Please enter your order number.",

    ecommerce_delivery:
      "🚚 Delivery\n\nPlease enter your order number.",

    ecommerce_payment:
      "💳 Payment\n\nPlease enter your order number or payment reference.",

    ecommerce_support:
      "Please describe what you need help with.",


    // --------------------------------------------------------
    // LAUNDRY
    // --------------------------------------------------------

    laundry_collection:
      "🧺 Laundry Collection\n\nPlease provide your address and preferred collection date.",

    laundry_delivery:
      "🚚 Laundry Delivery\n\nPlease provide your order number.",

    laundry_order:
      "🧺 Laundry Order\n\nPlease provide your order number.",

    laundry_services:
      "Please tell us what laundry service you need.",

    laundry_quote:
      "Please describe the laundry services you need so we can prepare a quotation.",

    laundry_payment:
      "Please enter your laundry order number.",

    laundry_support:
      "Please describe your enquiry.",


    // --------------------------------------------------------
    // FOOD
    // --------------------------------------------------------

    food_menu:
      "🍔 Menu\n\nToday's menu will be displayed here.",

    food_order:
      "🍽️ Order\n\nPlease enter the food items and quantities you would like.",

    food_order_status:
      "Please enter your order number.",

    food_collection:
      "Please enter your order number for collection information.",

    food_delivery:
      "Please enter your order number for delivery information.",

    food_specials:
      "🔥 Today's specials will be displayed here.",

    food_support:
      "Please describe your enquiry.",


    // --------------------------------------------------------
    // DRIVING SCHOOL
    // --------------------------------------------------------

    driving_register:
      "🚗 Learner Registration\n\nPlease enter your full name and contact details.",

    driving_lesson:
      "🚗 Driving Lesson\n\nPlease enter your preferred date and time.",

    driving_lesson_status:
      "Please enter your learner or lesson reference.",

    driving_instructor:
      "Please enter your learner reference.",

    driving_test:
      "Please enter your learner reference for test information.",

    driving_payment:
      "Please enter your learner reference.",

    driving_support:
      "Please describe what you need help with.",


    // --------------------------------------------------------
    // SCHOOL
    // --------------------------------------------------------

    school_parent:
      "🏫 Parent Services\n\nPlease enter the learner's name.",

    school_attendance:
      "Please enter the learner's name.",

    school_announcements:
      "📢 School announcements will be displayed here.",

    school_calendar:
      "📅 School calendar information will be displayed here.",

    school_fees:
      "💳 Please enter the learner's name or account reference.",

    school_teacher:
      "Please enter the learner's name and teacher enquiry.",

    school_office:
      "Please type your message for the school office.",


    // --------------------------------------------------------
    // DAYCARE
    // --------------------------------------------------------

    daycare_child:
      "👶 Please enter the child's name.",

    daycare_attendance:
      "Please enter the child's name.",

    daycare_pickup:
      "Please enter the child's name and pickup information.",

    daycare_activities:
      "🎨 Today's daycare activities will be displayed here.",

    daycare_fees:
      "Please enter the child's name.",

    daycare_announcements:
      "📢 Daycare announcements will be displayed here.",

    daycare_support:
      "Please type your message.",


    // --------------------------------------------------------
    // TRANSPORT
    // --------------------------------------------------------

    transport_booking:
      "🚐 Transport Booking\n\nPlease enter your pickup location, destination and preferred date/time.",

    transport_booking_status:
      "Please enter your booking reference.",

    transport_trip:
      "Please enter your trip reference.",

    transport_driver:
      "Please enter your booking reference.",

    transport_quote:
      "Please provide your pickup location, destination and transport requirements.",

    transport_payment:
      "Please enter your booking reference.",

    transport_support:
      "Please describe your enquiry.",


    // --------------------------------------------------------
    // IT BUSINESS
    // --------------------------------------------------------

    it_ticket:
      "💻 IT Support\n\nPlease describe the problem you are experiencing.",

    it_ticket_status:
      "Please enter your support ticket number.",

    it_quote:
      "Please describe the IT service you require.",

    it_service:
      "Please describe the service you require.",

    it_invoice:
      "Please enter your invoice number.",

    it_problem:
      "Please describe the problem.",

    it_support:
      "Please type your message for the IT team.",


    // --------------------------------------------------------
    // BUILDING MATERIALS
    // --------------------------------------------------------

    building_stock:
      "🧱 Product Availability\n\nEnter the product name and quantity.",

    building_quote:
      "Please list the building materials you require.",

    building_order:
      "Please list the products and quantities you would like to order.",

    building_order_status:
      "Please enter your order number.",

    building_delivery:
      "Please enter your order number.",

    building_payment:
      "Please enter your invoice or order number.",

    building_sales:
      "Please type your message for the sales team.",


    // --------------------------------------------------------
    // WHOLESALE
    // --------------------------------------------------------

    wholesale_products:
      "Please enter the product or category you need.",

    wholesale_stock:
      "Please enter the product and quantity you want to check.",

    wholesale_order:
      "Please enter the products and quantities you would like to order.",

    wholesale_quote:
      "Please list the products and quantities required for your quotation.",

    wholesale_order_status:
      "Please enter your order number.",

    wholesale_delivery:
      "Please enter your order number.",

    wholesale_payment:
      "Please enter your invoice or order number.",

    wholesale_sales:
      "Please type your message for the sales team.",


    // --------------------------------------------------------
    // NPO
    // --------------------------------------------------------

    npo_beneficiary:
      "Please enter the beneficiary information or assistance required.",

    npo_volunteer:
      "Please enter your name, contact number and area of interest.",

    npo_programme:
      "Please select or enter the programme you would like information about.",

    npo_donation:
      "Thank you for supporting the organisation. Please select your preferred donation method.",

    npo_assistance:
      "Please describe the assistance you require.",

    npo_announcements:
      "📢 Current organisation announcements will be displayed here.",


    // --------------------------------------------------------
    // COMMUNITY
    // --------------------------------------------------------

    community_report:
      "🏘️ Community Report\n\nPlease describe the problem you want to report.",

    community_status:
      "Please enter your community report reference number.",

    community_electricity:
      "⚡ Electricity Report\n\nPlease describe the electricity problem and location.",

    community_water:
      "💧 Water Report\n\nPlease describe the water problem and location.",

    community_roads:
      "🛣️ Road Report\n\nPlease describe the road problem and location.",

    community_dumping:
      "🗑️ Illegal Dumping Report\n\nPlease provide the location and description.",

    community_other:
      "Please describe the community problem.",


    // --------------------------------------------------------
    // OTHER SERVICES
    // --------------------------------------------------------

    service_request:
      "Please describe the service you require.",

    service_booking:
      "Please provide your preferred date and time.",

    service_quote:
      "Please describe the service you require so we can prepare a quotation.",

    service_job_status:
      "Please enter your job reference.",

    service_invoice:
      "Please enter your invoice number.",

    service_payment:
      "Please enter your invoice or payment reference.",

    service_support:
      "Please describe your enquiry."
  };


  return (
    messages[workflowCode] ||
    `You have selected ${config.name}. Please provide the requested information.`
  );
}


// ============================================================
// DETERMINE WORKFLOW FROM MENU SELECTION
// ============================================================

export function getIndustryWorkflow(
  moduleCode,
  selection
) {

  const config =
    getIndustryWhatsAppConfig(
      moduleCode
    );

  const key =
    String(selection || "")
      .trim()
      .toLowerCase();

  if (
    config.workflows[key]
  ) {
    return config.workflows[key];
  }

  return null;
}


// ============================================================
// DETECT COMMON COMMANDS
// ============================================================

export function detectIndustryCommand(
  text
) {

  const value =
    String(text || "")
      .trim()
      .toLowerCase();

  if (
    value === "menu" ||
    value === "home" ||
    value === "start" ||
    value === "hi" ||
    value === "hello"
  ) {
    return "menu";
  }

  if (
    value === "help"
  ) {
    return "help";
  }

  if (
    value === "cancel" ||
    value === "stop"
  ) {
    return "cancel";
  }

  return null;
}


// ============================================================
// BUILD HELP MESSAGE
// ============================================================

export function buildIndustryHelp(
  moduleCode
) {

  const config =
    getIndustryWhatsAppConfig(
      moduleCode
    );

  return (
    `You are using the ${config.name} WhatsApp Assistant.\n\n` +
    `Reply MENU to see the available services.\n` +
    `Reply CANCEL to cancel the current request.\n` +
    `Reply HELP for assistance.`
  );
}


// ============================================================
// BUILD CANCEL MESSAGE
// ============================================================

export function buildIndustryCancel() {

  return (
    "Your current WhatsApp request has been cancelled.\n\n" +
    "Reply MENU to return to the main menu."
  );
}


// ============================================================
// EXPORT MODULE LIST
// ============================================================

export function getIndustryWhatsAppModules() {

  return Object.entries(
    INDUSTRY_WHATSAPP_MODULES
  ).map(
    ([moduleCode, config]) => ({
      module_code: moduleCode,
      module_name: config.name,
      menu_items: config.menu.length,
      workflows: Object.values(
        config.workflows
      )
    })
  );
    }
