import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../../features/users/User.js";
import Job from "../../features/jobs/Job.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const locations = [
  ["Phnom Penh", 11.5564, 104.9282],
  ["Siem Reap", 13.3633, 103.8564],
  ["Battambang", 13.0957, 103.2022],
  ["Kampot", 10.6104, 104.1810],
  ["Sihanoukville", 10.6253, 103.5234],
];

const roles = [
  ["Frontend Developer", "Technology", ["JavaScript", "React", "CSS"]],
  ["Backend Developer", "Technology", ["Node.js", "MongoDB", "REST APIs"]],
  ["UI/UX Designer", "Design", ["Figma", "Prototyping", "User Research"]],
  ["Digital Marketing Specialist", "Marketing", ["SEO", "Content Marketing", "Analytics"]],
  ["Sales Representative", "Sales", ["Negotiation", "CRM", "Communication"]],
  ["Accountant", "Finance", ["Bookkeeping", "Excel", "Financial Reporting"]],
  ["Customer Support Officer", "Customer Service", ["Customer Support", "Problem Solving", "English"]],
  ["Operations Coordinator", "Operations", ["Planning", "Logistics", "Reporting"]],
  ["Graphic Designer", "Design", ["Illustrator", "Photoshop", "Branding"]],
  ["Data Analyst", "Technology", ["SQL", "Excel", "Data Visualization"]],
];

const companyNames = [
  "Mekong Digital", "Angkor Innovations", "Tonle Solutions", "Lotus Commerce", "Khmer Cloud",
  "Bayon Creative", "Emerald Logistics", "Sabay Services", "Palm Tech", "Riverstone Group",
];

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");

  await mongoose.connect(process.env.MONGODB_URI);
  const databaseName = mongoose.connection.name;
  await mongoose.connection.dropDatabase();

  const password = await bcrypt.hash("LinklidSeed2026!", 12);
  const employers = await User.insertMany(companyNames.map((companyName, index) => {
    const [address, lat, lng] = locations[index % locations.length];
    return {
      name: `${companyName} Hiring Team`,
      email: `employer${index + 1}@linklid.seed`,
      password,
      role: "employer",
      accountType: "employer",
      trustScore: 90 + (index % 10),
      isVerified: true,
      verifiedBadges: ["email", "business", "phone"],
      location: { lat, lng, address, geo: { type: "Point", coordinates: [lng, lat] } },
      preferredLanguage: index % 2 ? "en" : "km",
      companyName,
      companyLogo: `https://placehold.co/256x256/4f46e5/ffffff?text=${encodeURIComponent(companyName.slice(0, 2))}`,
      companyCoverPicture: `https://placehold.co/1200x400/1e293b/ffffff?text=${encodeURIComponent(companyName)}`,
      companyWebsite: `https://example.com/company-${index + 1}`,
      companyAddress: `${address}, Cambodia`,
      companySize: `${25 + index * 15}-${50 + index * 20} employees`,
      companyLocation: { address: `${address}, Cambodia`, lat, lng, geo: { type: "Point", coordinates: [lng, lat] } },
      companyLocationBonusGranted: true,
      businessRegistration: `KH-REG-2026-${String(index + 1).padStart(4, "0")}`,
      companyDescription: `${companyName} is a growing Cambodian company building reliable products and services for local customers.`,
      businessPhoneNumber: `+855 10 555 ${String(100 + index)}`,
      businessTelegramUsername: `linklid_employer_${index + 1}`,
      phoneNumber: `+855 10 555 ${String(100 + index)}`,
      telegramUsername: `linklid_employer_${index + 1}`,
      profilePicture: `https://placehold.co/256x256/4f46e5/ffffff?text=${encodeURIComponent(companyName.slice(0, 2))}`,
      profileCompletionBonusGranted: true,
      preferredContactMethod: "telegram",
      bio: `Hiring talented people for ${companyName}.`,
      university: "",
      school: "",
      skills: ["Hiring", "Leadership", "Communication"],
      languages: ["Khmer", "English"],
      educationHistory: [],
      workExperience: [],
      preferredCategory: "Human Resources",
      preferredCategories: ["Human Resources", "Operations"],
      preferredLocation: address,
      isFirstLogin: false,
      history: [],
      verifiedApplicationsCount: 0,
      savedJobs: [],
      rating: 4.5 + (index % 5) / 10,
      onboardingComplete: true,
      adminRole: "none",
    };
  }));

  const jobs = Array.from({ length: 50 }, (_, index) => {
    const employer = employers[index % employers.length];
    const [title, category, requiredSkills] = roles[index % roles.length];
    const [address, lat, lng] = locations[index % locations.length];
    const remote = index % 5 === 0;
    const experienceLevel = ["entry", "junior", "senior"][index % 3];
    const tierLevel = remote ? "remote" : ["no_experience", "junior", "senior"][index % 3];
    const vacancies = 1 + (index % 5);

    return {
      title: `${title} ${Math.floor(index / roles.length) + 1}`,
      description: `Join ${employer.companyName} as a ${title}. You will collaborate with a supportive team, deliver high-quality work, communicate progress clearly, and help improve services for customers across Cambodia.`,
      salary: `$${350 + index * 25} - $${550 + index * 30} per month`,
      employerId: employer._id,
      companyId: employer._id,
      companyProfile: {
        companyName: employer.companyName,
        companyLogo: employer.companyLogo,
        companyWebsite: employer.companyWebsite,
        companySize: employer.companySize,
        businessRegistration: employer.businessRegistration,
        companyDescription: employer.companyDescription,
      },
      location: { lat, lng, address: remote ? `Remote / ${address}, Cambodia` : `${address}, Cambodia`, geo: { type: "Point", coordinates: [lng, lat] } },
      isFeatured: index % 7 === 0,
      category,
      requiredSkills,
      is_remote: remote,
      tier_level: tierLevel,
      isRemote: remote,
      experienceLevel,
      min_experience: experienceLevel === "entry" ? 0 : experienceLevel === "junior" ? 1 : 4,
      applicants: [],
      vacancies,
      hiredCount: 0,
      hiringLimit: vacancies,
      views: 25 + index * 13,
      status: "open",
      jobType: ["full-time", "part-time", "gig"][index % 3],
      urgency: ["high", "medium", "low"][index % 3],
      paymentStatus: ["unpaid", "paid_online", "cash_on_site"][index % 3],
      metadata: { views: 25 + index * 13, applyCount: 0, ai_indexed_at: new Date() },
    };
  });

  await Job.insertMany(jobs);
  console.log(`Reset database "${databaseName}" and created ${employers.length} employers and ${jobs.length} jobs.`);
};

run()
  .catch((error) => {
    console.error("Database reset/seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());

