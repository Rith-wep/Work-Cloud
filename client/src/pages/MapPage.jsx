import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaBolt,
  FaBroom,
  FaCheckCircle,
  FaCode,
  FaCrosshairs,
  FaHardHat,
  FaListUl,
  FaMapMarkedAlt,
  FaMapMarkerAlt,
  FaStar,
  FaRegBookmark,
  FaSearch,
  FaPaperPlane,
  FaTruck,
  FaUserGraduate,
  FaUsers,
} from "react-icons/fa/index.js";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getCandidateSkillSet, getTopSkills, normalizeSkill, toSkillKey } from "../utils/skills.js";
import { toastError, toastSuccess } from "../utils/toast.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const silverMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const MAP_CATEGORIES = [
  { key: "All", icon: FaBolt },
  { key: "AllJobs", icon: FaUsers },
  { key: "Match", icon: FaCheckCircle },
  { key: "Delivery", icon: FaTruck },
  { key: "Cleaning", icon: FaBroom },
  { key: "Construction", icon: FaHardHat },
  { key: "IT/Digital", icon: FaCode },
  { key: "Teaching", icon: FaUserGraduate },
  { key: "Event Staff", icon: FaUsers },
];
const CATEGORY_ICON_BY_KEY = {
  all: FaBolt,
  alljobs: FaUsers,
  match: FaCheckCircle,
  delivery: FaTruck,
  cleaning: FaBroom,
  construction: FaHardHat,
  it_digital: FaCode,
  teaching: FaUserGraduate,
  event_staff: FaUsers,
};
const EMPLOYER_ACTIVE_STATUSES = new Set(["pending", "contracted", "awaiting_confirmation", "completed"]);
const INACTIVE_JOB_STATUSES = new Set(["closed", "archived"]);

const toRadians = (value) => (Number(value) * Math.PI) / 180;
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

function MapPage() {
  const { user, token, setUser } = useAuth();
  const { t, i18n } = useTranslation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userLocationMarkerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [employerCandidates, setEmployerCandidates] = useState([]);
  const [companyLocation, setCompanyLocation] = useState(null);
  const [pendingByJobId, setPendingByJobId] = useState({});
  const [pendingPreviewByJobId, setPendingPreviewByJobId] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState("map");
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [isSavingJobId, setIsSavingJobId] = useState("");
  const [isApplyingJobId, setIsApplyingJobId] = useState("");
  const [isSidebarInteracting, setIsSidebarInteracting] = useState(false);
  const isEmployer = user?.role === "employer";
  const userId = String(user?.id || user?._id || "").trim();
  const savedJobIds = useMemo(
    () => new Set((Array.isArray(user?.savedJobs) ? user.savedJobs : []).map(String)),
    [user?.savedJobs]
  );
  const preferredCategoryKeys = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(Array.isArray(user?.preferredCategories) ? user.preferredCategories : []),
            user?.preferredCategory,
          ]
            .map((entry) => toSkillKey(String(entry || "").trim()))
            .filter(Boolean)
        )
      ),
    [user?.preferredCategories, user?.preferredCategory]
  );
  const mapCategoryOptions = useMemo(() => {
    const baseKeys = new Set(MAP_CATEGORIES.map((entry) => toSkillKey(entry.key)));
    const dynamicEntries = (Array.isArray(catalogCategories) ? catalogCategories : [])
      .filter((entry) => !baseKeys.has(toSkillKey(entry.key || entry.label || "")))
      .map((entry) => ({
        key: entry.label || entry.key,
        icon: CATEGORY_ICON_BY_KEY[toSkillKey(entry.key || entry.label || "")] || FaBolt,
      }));
    return [...MAP_CATEGORIES, ...dynamicEntries];
  }, [catalogCategories]);
  const candidateSkillSet = useMemo(
    () => getCandidateSkillSet(user?.skills),
    [user?.skills]
  );
  const activeLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const imageBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    return apiBase.replace(/\/api\/?$/, "");
  }, []);

  useEffect(() => {
    if (window.google?.maps) {
      setIsMapReady(true);
      return;
    }

    const interval = window.setInterval(() => {
      if (window.google?.maps) {
        setIsMapReady(true);
        window.clearInterval(interval);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) {
      setCatalogCategories([]);
      return;
    }
    const fetchCatalog = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load categories");
        }
        setCatalogCategories(Array.isArray(data.categories) ? data.categories : []);
      } catch {
        setCatalogCategories([]);
      }
    };
    fetchCatalog();
  }, [token]);

  useEffect(() => {
    const fetchRoleJobs = async () => {
      try {
        setIsLoading(true);
        setError("");

        if (isEmployer) {
          const applicationsRes = await fetch(`${API_BASE_URL}/applications/employer`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const applicationsData = await applicationsRes.json();
          if (!applicationsRes.ok) {
            throw new Error(applicationsData.message || "Failed to fetch applications");
          }

          const nextCompanyLocation = {
            lat: Number(applicationsData?.companyLocation?.lat),
            lng: Number(applicationsData?.companyLocation?.lng),
            address: applicationsData?.companyLocation?.address || "",
          };
          const hasCompanyLocation =
            Number.isFinite(nextCompanyLocation.lat) && Number.isFinite(nextCompanyLocation.lng);

          const pendingCounts = {};
          const pendingPreviews = {};
          const candidateMap = new Map();
          (applicationsData.applications || []).forEach((application) => {
            const jobId = String(application?.jobId?._id || application?.jobId || "");
            const jobStatus = String(application?.jobId?.status || "").toLowerCase();
            const isActiveJob = !INACTIVE_JOB_STATUSES.has(jobStatus);
            if (!jobId || !isActiveJob) {
              return;
            }
            if (!jobId || application?.status !== "pending") {
              // continue below for candidate marker collection
            } else {
              pendingCounts[jobId] = (pendingCounts[jobId] || 0) + 1;

              const rawPicture = String(application?.candidateId?.profilePicture || "").trim();
              if (rawPicture) {
                const normalizedPicture =
                  rawPicture.startsWith("http://") || rawPicture.startsWith("https://")
                    ? rawPicture
                    : `${imageBaseUrl}${rawPicture.startsWith("/") ? rawPicture : `/${rawPicture}`}`;

                const current = pendingPreviews[jobId] || [];
                if (current.length < 3) {
                  current.push(normalizedPicture);
                  pendingPreviews[jobId] = current;
                }
              }
            }

            if (!EMPLOYER_ACTIVE_STATUSES.has(String(application?.status || "").toLowerCase())) {
              return;
            }

            const candidate = application?.candidateId || {};
            const candidateId = String(candidate?._id || "");
            const candidateLat = Number(candidate?.location?.lat);
            const candidateLng = Number(candidate?.location?.lng);
            const jobLat = Number(application?.jobId?.location?.lat);
            const jobLng = Number(application?.jobId?.location?.lng);
            const hasCandidateCoords = Number.isFinite(candidateLat) && Number.isFinite(candidateLng);
            const lat = hasCandidateCoords ? candidateLat : jobLat;
            const lng = hasCandidateCoords ? candidateLng : jobLng;
            if (!candidateId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
              return;
            }

            if (!candidateMap.has(candidateId)) {
              const candidateDistanceKm = hasCompanyLocation
                ? Number(distanceKm(nextCompanyLocation.lat, nextCompanyLocation.lng, lat, lng).toFixed(1))
                : null;
              candidateMap.set(candidateId, {
                _id: candidateId,
                name: candidate?.name || t("common.candidate", { defaultValue: "Candidate" }),
                trustScore: Number(candidate?.trustScore || 0),
                profilePicture: candidate?.profilePicture || "",
                location: {
                  lat,
                  lng,
                  address: candidate?.location?.address || application?.jobId?.location?.address || "",
                },
                verifiedContact:
                  Boolean(String(candidate?.phoneNumber || "").trim()) &&
                  Boolean(String(candidate?.telegramUsername || "").trim()),
                status: String(application?.status || "pending"),
                applicationStatus: String(application?.status || "pending"),
                jobTitle: application?.jobId?.title || "",
                salary: application?.jobId?.salary || "",
                distanceKm: Number.isFinite(candidateDistanceKm) ? candidateDistanceKm : null,
                markerSource: hasCandidateCoords ? "candidate" : "job",
              });
            }
          });

          setCompanyLocation(hasCompanyLocation ? nextCompanyLocation : null);
          setEmployerCandidates(Array.from(candidateMap.values()));
          setJobs([]);
          setPendingByJobId(pendingCounts);
          setPendingPreviewByJobId(pendingPreviews);
          return;
        }

        let activeJobs = [];
        const response = await fetch(
          `${API_BASE_URL}/jobs`,
          token
            ? {
                headers: { Authorization: `Bearer ${token}` },
              }
            : undefined
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch jobs");
        }
        activeJobs = (data.jobs || []).filter(
          (job) => job.status !== "closed" && job.status !== "archived"
        );

        setJobs(activeJobs);
        setEmployerCandidates([]);
        setCompanyLocation(null);
        setPendingByJobId({});
        setPendingPreviewByJobId({});
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoleJobs();
  }, [
    activeLanguage,
    imageBaseUrl,
    isEmployer,
    t,
    token,
    user?.isVerified,
    user?.preferredCategory,
    user?.preferredExperienceLevel,
    user?.prefersRemote,
    user?.preferredCategories,
    user?.skills,
    userId,
  ]);

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return jobs;
    }

    return jobs.filter((job) => {
      const title = String(job?.title || "").toLowerCase();
      const company = String(
        job?.companyProfile?.companyName || job?.employerId?.companyName || job?.employerId?.name || ""
      ).toLowerCase();
      const location = String(job?.location?.address || "").toLowerCase();
      return title.includes(normalized) || company.includes(normalized) || location.includes(normalized);
    });
  }, [jobs, query]);

  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return employerCandidates;
    }
    return employerCandidates.filter((candidate) => {
      const name = String(candidate?.name || "").toLowerCase();
      const jobTitle = String(candidate?.jobTitle || "").toLowerCase();
      const location = String(candidate?.location?.address || "").toLowerCase();
      return name.includes(normalized) || jobTitle.includes(normalized) || location.includes(normalized);
    });
  }, [employerCandidates, query]);

  const sortedEmployerCandidates = useMemo(() => {
    if (!isEmployer) {
      return [];
    }

    return [...filteredCandidates].sort((a, b) => {
      const aDistance = Number.isFinite(a?.distanceKm) ? Number(a.distanceKm) : Number.POSITIVE_INFINITY;
      const bDistance = Number.isFinite(b?.distanceKm) ? Number(b.distanceKm) : Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });
  }, [filteredCandidates, isEmployer]);

  const candidateCategoryFilteredJobs = useMemo(() => {
    if (isEmployer) {
      return filteredJobs;
    }

    if (activeCategory === "AllJobs") {
      return filteredJobs;
    }

    if (activeCategory === "All") {
      if (!preferredCategoryKeys.length) return filteredJobs;
      return filteredJobs.filter((job) =>
        preferredCategoryKeys.includes(toSkillKey(String(job?.category || "")))
      );
    }

    if (activeCategory === "Match") {
      if (!preferredCategoryKeys.length) return [];
      return filteredJobs.filter((job) =>
        preferredCategoryKeys.includes(toSkillKey(String(job?.category || "")))
      );
    }

    return filteredJobs.filter(
      (job) => toSkillKey(String(job?.category || "")) === toSkillKey(String(activeCategory || ""))
    );
  }, [activeCategory, filteredJobs, isEmployer, preferredCategoryKeys]);

  const displayedItems = useMemo(
    () => (isEmployer ? sortedEmployerCandidates : candidateCategoryFilteredJobs),
    [candidateCategoryFilteredJobs, isEmployer, sortedEmployerCandidates]
  );

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 11.5564, lng: 104.9282 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        styles: silverMapStyle,
      });
    }

    const map = mapInstanceRef.current;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    displayedItems.forEach((item) => {
      const lat = Number(item?.location?.lat);
      const lng = Number(item?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const itemId = String(item?._id || "");
      const pendingCount = Number(pendingByJobId[itemId] || 0);
      const markerTitle = isEmployer
        ? `${item?.name || t("common.candidate", { defaultValue: "Candidate" })} | ${t("profile.trustScore", {
            defaultValue: "Trust Score",
          })}: ${Number(item?.trustScore || 0)} | ${t("common.status", { defaultValue: "Status" })}: ${
            item?.applicationStatus || item?.status || t("common.pending", { defaultValue: "Pending" })
          }`
        : item?.title || t("jobs.job", { defaultValue: "Job" });
      const matchScore = Number(item?.matchScore || 0);
      const isEliteMatch = !isEmployer && matchScore >= 90;
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: markerTitle,
        label:
          !isEmployer && isEliteMatch
            ? { text: "★", color: "#ffffff", fontWeight: "700" }
            : !isEmployer && pendingCount > 0
              ? { text: String(pendingCount), color: "#ffffff", fontWeight: "700" }
              : undefined,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: !isEmployer && pendingCount > 0 ? 12 : 9,
          fillColor: "#4F46E5",
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        if (isEmployer) {
          setSelectedCandidate(item);
          setSelectedJob(null);
          return;
        }
        setSelectedJob(item);
        setSelectedCandidate(null);
      });

      bounds.extend({ lat, lng });
      markersRef.current.push(marker);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
    }
  }, [displayedItems, i18n.language, isEmployer, isMapReady, pendingByJobId, t]);

  const toggleSaveJob = async (jobId) => {
    if (!token) {
      toastError(t("auth.signInToSave", { defaultValue: "Please login to save jobs" }));
      return;
    }

    try {
      setIsSavingJobId(jobId);
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/save`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("jobCard.failedSave", { defaultValue: "Failed to save job" }));
      }

      setUser((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          savedJobs: Array.isArray(data.savedJobs) ? data.savedJobs : prev.savedJobs,
        };
      });
      toastSuccess(
        data.saved
          ? t("jobCard.savedSuccess", { defaultValue: "Job saved to your collection!" })
          : t("jobCard.removedSaved", { defaultValue: "Removed from saved jobs" })
      );
    } catch (err) {
      toastError(err.message || t("jobCard.failedSave", { defaultValue: "Failed to save job" }));
    } finally {
      setIsSavingJobId("");
    }
  };

  const applyToJob = async (jobId) => {
    if (!token) {
      toastError(t("auth.signInToApply", { defaultValue: "Please login to apply" }));
      return;
    }

    try {
      setIsApplyingJobId(jobId);
      const response = await fetch(`${API_BASE_URL}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("jobDetails.failedApply", { defaultValue: "Failed to apply" }));
      }
      toastSuccess(t("apply.sent", { defaultValue: "Application sent" }));
    } catch (err) {
      toastError(err.message || t("jobDetails.failedApply", { defaultValue: "Failed to apply" }));
    } finally {
      setIsApplyingJobId("");
    }
  };

  useEffect(() => {
    if (!isMapReady || !window.google?.maps?.places || !searchInputRef.current || !mapInstanceRef.current) {
      return;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ["formatted_address", "geometry", "name"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place?.geometry?.location;
      if (!location) {
        return;
      }

      mapInstanceRef.current?.panTo({ lat: location.lat(), lng: location.lng() });
      mapInstanceRef.current?.setZoom(14);
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isMapReady]);

  useEffect(() => {
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setTitle(
        t("map.youAreHere", { defaultValue: "You are here" })
      );
    }
  }, [i18n.language, t]);

  const centerToMyLocation = () => {
    if (!mapInstanceRef.current || !navigator.geolocation) {
      setError(t("map.geolocationUnsupported", { defaultValue: "Geolocation is not supported by your browser." }));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        mapInstanceRef.current?.panTo(userPos);
        mapInstanceRef.current?.setZoom(14);

        if (window.google?.maps && mapInstanceRef.current) {
          if (!userLocationMarkerRef.current) {
            userLocationMarkerRef.current = new window.google.maps.Marker({
              position: userPos,
              map: mapInstanceRef.current,
              title: t("map.youAreHere", { defaultValue: "You are here" }),
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#10B981",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
              zIndex: 999,
            });
          } else {
            userLocationMarkerRef.current.setMap(mapInstanceRef.current);
            userLocationMarkerRef.current.setPosition(userPos);
            userLocationMarkerRef.current.setTitle(
              t("map.youAreHere", { defaultValue: "You are here" })
            );
          }
        }

        setIsLocating(false);
      },
      (geoError) => {
        setError(geoError.message || t("map.locationAccessFailed", { defaultValue: "Unable to access location." }));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <section className="-mx-4 -mt-6">
      {!GOOGLE_MAPS_KEY ? (
        <p className="mx-4 mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {t("map.missingKey", { defaultValue: "Missing `VITE_GOOGLE_MAPS_API_KEY` in client environment." })}
        </p>
      ) : null}

      {error ? (
        <p className="mx-4 mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      <div className="relative h-[calc(100vh-9.5rem)] w-full overflow-hidden rounded-none bg-slate-100">
        <div ref={mapRef} className="h-full w-full" />

        <div className="absolute left-3 right-3 top-3 z-20 space-y-2">
          <div
            className={`flex items-center gap-2 rounded-2xl border border-white/50 bg-white/80 p-2 backdrop-blur transition-all duration-300 ${
              isSidebarInteracting ? "opacity-75" : "opacity-100"
            }`}
          >
            <FaSearch className="ml-1 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                isEmployer
                  ? t("map.searchEmployer", { defaultValue: "Search your jobs or locations" })
                  : t("map.searchCandidate", { defaultValue: "Search jobs, company, location" })
              }
              className="h-9 w-full bg-transparent px-1 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "map" ? "list" : "map"))}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              {viewMode === "map" ? <FaListUl size={14} /> : <FaMapMarkedAlt size={14} />}
              <span>{viewMode === "map" ? t("map.listView", { defaultValue: "List" }) : t("map.mapView", { defaultValue: "Map" })}</span>
            </button>
          </div>
          {!isEmployer ? (
            <div
              className={`flex flex-nowrap gap-2 overflow-x-auto rounded-2xl border border-white/50 bg-white/80 p-2 backdrop-blur transition-all duration-300 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                isSidebarInteracting ? "opacity-75" : "opacity-100"
              }`}
            >
              {mapCategoryOptions.map((category) => {
                const active = category.key === activeCategory;
                const Icon = category.icon;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setActiveCategory(category.key)}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition-all duration-300 ${
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white shadow-indigo-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"
                    }`}
                  >
                    <Icon size={13} className={active ? "text-white" : "text-slate-500"} />
                    <span>
                      {category.key === "All"
                        ? t("dashboard.forYou", { defaultValue: "For You" })
                        : category.key === "AllJobs"
                          ? t("dashboard.allJobs", { defaultValue: "All Jobs" })
                        : category.key === "Match"
                          ? t("dashboard.match", { defaultValue: "Match" })
                          : t(`categories.${String(category.key).toLowerCase().replace("/", "_")}`, {
                              defaultValue: category.key,
                            })}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={centerToMyLocation}
          className="absolute bottom-4 right-4 z-20 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
        >
          <FaCrosshairs size={14} />
          <span>{isLocating ? t("map.locating", { defaultValue: "Locating..." }) : t("map.recenter", { defaultValue: "Recenter" })}</span>
        </button>

        {isLoading ? (
          <div className="absolute left-4 top-16 rounded-lg bg-white/90 px-3 py-2 text-sm text-slate-700 shadow">
            {t("map.loadingMapJobs", { defaultValue: "Loading map jobs..." })}
          </div>
        ) : null}

        <AnimatePresence>
          {viewMode === "list" ? (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="absolute bottom-0 right-0 top-0 z-30 w-full border-l border-slate-200 bg-white/95 p-3 backdrop-blur-lg sm:w-[360px]"
              onMouseEnter={() => setIsSidebarInteracting(true)}
              onMouseLeave={() => setIsSidebarInteracting(false)}
            >
              <h2 className="mb-2 text-sm font-bold text-slate-900">
                {isEmployer
                  ? t("map.talentMode", { defaultValue: "Talent Mode" })
                  : t("map.nearbyOpportunities", { defaultValue: "Nearby Opportunities" })}
              </h2>

              <div className="max-h-full space-y-2 overflow-y-auto pb-20">
                {(isEmployer ? sortedEmployerCandidates : candidateCategoryFilteredJobs).map((job) => {
                  if (isEmployer) {
                    return (
                      <button
                        key={job._id}
                        type="button"
                        onClick={() => {
                          setSelectedCandidate(job);
                          setSelectedJob(null);
                        }}
                        className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50"
                      >
                        <p className="text-sm font-bold text-slate-900">{job.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{job.jobTitle || t("map.activeCandidate", { defaultValue: "Active Candidate" })}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {job?.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-primary">
                            {t("profile.trustScore", { defaultValue: "Trust Score" })}: {Number(job?.trustScore || 0)}
                          </span>
                          {job?.verifiedContact ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              {t("common.verifiedContact", { defaultValue: "Verified Contact" })}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                            {t("common.status", { defaultValue: "Status" })}:{" "}
                            {job?.applicationStatus || job?.status || t("common.pending", { defaultValue: "Pending" })}
                          </span>
                          {Number.isFinite(job?.distanceKm) ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-primary">
                              {t("map.distanceKm", {
                                defaultValue: "{{distance}} km",
                                distance: job.distanceKm,
                              })}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  }

                  const pendingCount = Number(pendingByJobId[String(job._id)] || 0);
                  const pendingPictures = pendingPreviewByJobId[String(job._id)] || [];
                  const topSkills = getTopSkills(job?.requiredSkills, 3);
                  return (
                    <Link
                      key={job._id}
                      to={`/jobs/${job._id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                    >
                      <p className="text-sm font-bold text-indigo-600">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job?.companyProfile?.companyName ||
                          job?.employerId?.companyName ||
                          job?.employerId?.name ||
                          t("common.company", { defaultValue: "Company" })}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job?.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
                      </p>
                      {topSkills.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {topSkills.map((skill) => {
                            const isMatched = candidateSkillSet.has(normalizeSkill(skill));
                            return (
                              <span
                                key={`${job._id}-map-list-skill-${skill}`}
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  isMatched
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-indigo-50 text-indigo-700"
                                } ${
                                  activeLanguage === "km"
                                    ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
                                    : ""
                                } whitespace-nowrap`}
                              >
                                {t(`skills.${toSkillKey(skill)}`, { defaultValue: skill })}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-secondary">
                          {job.salary || t("jobCard.negotiable", { defaultValue: "Negotiable" })}
                        </span>
                        {isEmployer ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-primary">
                              <FaUsers size={11} />
                              <span>
                                {t("workspace.pendingCount", {
                                  defaultValue: "Pending {{count}}",
                                  count: pendingCount,
                                })}
                              </span>
                            </span>
                            {pendingPictures.length ? (
                              <span className="inline-flex items-center -space-x-2">
                                {pendingPictures.map((pictureUrl, idx) => (
                                  <img
                                    key={`${job._id}-${idx}`}
                                    src={pictureUrl}
                                    alt="Candidate"
                                    loading="lazy"
                                    decoding="async"
                                    className="h-6 w-6 rounded-full border-2 border-white object-cover"
                                  />
                                ))}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-primary">
                            <FaMapMarkerAlt size={11} />
                            <span>{t("common.view", { defaultValue: "View" })}</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}

                {!(isEmployer ? sortedEmployerCandidates : candidateCategoryFilteredJobs).length ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    {isEmployer
                      ? t("map.noApplicants", { defaultValue: "No applicants found for your active jobs." })
                      : t("dashboard.noJobs", { defaultValue: "No jobs found." })}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {selectedJob ? (
            <motion.div
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="absolute bottom-4 left-3 right-3 z-30 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-xl backdrop-blur sm:left-4 sm:right-4"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif", lineHeight: 1.6 }}
            >
              {(() => {
                const topSkills = getTopSkills(selectedJob?.requiredSkills, 3);
                if (!topSkills.length) return null;
                return (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {topSkills.map((skill) => {
                      const isMatched = candidateSkillSet.has(normalizeSkill(skill));
                      return (
                        <span
                          key={`${selectedJob?._id}-preview-skill-${skill}`}
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            isMatched
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-indigo-50 text-indigo-700"
                          } ${
                            activeLanguage === "km"
                              ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
                              : ""
                          } whitespace-nowrap`}
                        >
                          {t(`skills.${toSkillKey(skill)}`, { defaultValue: skill })}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-indigo-600">{selectedJob.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedJob?.companyProfile?.companyName ||
                      selectedJob?.employerId?.companyName ||
                      selectedJob?.employerId?.name ||
                      t("common.company", { defaultValue: "Company" })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedJob?.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
                  </p>
                  <div
                    className={`mt-2 flex flex-wrap items-center gap-2 ${
                      activeLanguage === "km"
                        ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
                        : ""
                    }`}
                    style={activeLanguage === "km" ? { lineHeight: 1.6 } : undefined}
                  >
                    <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {t("jobDetails.salaryLabel", { defaultValue: "Salary" })}:{" "}
                      {selectedJob?.salary || t("jobCard.negotiable", { defaultValue: "Negotiable" })}
                    </span>
                    {Boolean(user?.isVerified) && Number(selectedJob?.matchScore || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                        <FaStar size={10} />
                        <span>
                          {`${Math.max(0, Math.min(100, Math.round(Number(selectedJob?.matchScore || 0))))}% ${t("map.match", {
                            defaultValue: "Match",
                          })}`}
                        </span>
                      </span>
                    ) : null}
                    {!Boolean(user?.isVerified) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                        <FaStar size={10} />
                        <span>{t("map.recommendedForYou", { defaultValue: "Recommended for You" })}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  x
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {isEmployer ? (
                  <Link
                    to={`/jobs/${selectedJob._id}`}
                    className="inline-flex h-10 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-white"
                  >
                    {t("map.viewDetails", { defaultValue: "View Details" })}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => applyToJob(selectedJob._id)}
                      disabled={isApplyingJobId === selectedJob._id}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <FaPaperPlane size={14} />
                      <span>
                        {isApplyingJobId === selectedJob._id
                          ? t("apply.applying", { defaultValue: "Applying..." })
                          : t("jobDetails.apply", { defaultValue: "Apply to this Job" })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSaveJob(selectedJob._id)}
                      disabled={isSavingJobId === selectedJob._id}
                      className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-60 ${
                        savedJobIds.has(String(selectedJob._id))
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <FaRegBookmark size={14} />
                      <span>
                        {isSavingJobId === selectedJob._id
                          ? t("common.saving", { defaultValue: "Saving..." })
                          : savedJobIds.has(String(selectedJob._id))
                            ? t("jobCard.saved", { defaultValue: "Saved" })
                            : t("jobCard.save", { defaultValue: "Save" })}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {selectedCandidate && isEmployer ? (
            <motion.div
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="absolute bottom-4 left-3 right-3 z-30 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-xl backdrop-blur sm:left-4 sm:right-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{selectedCandidate?.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedCandidate?.jobTitle || t("map.activeCandidate", { defaultValue: "Active Candidate" })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedCandidate?.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  x
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex h-9 items-center rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-primary">
                  {t("profile.trustScore", { defaultValue: "Trust Score" })}: {Number(selectedCandidate?.trustScore || 0)}
                </span>
                <span className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700">
                  {t("common.status", { defaultValue: "Status" })}:{" "}
                  {selectedCandidate?.applicationStatus ||
                    selectedCandidate?.status ||
                    t("common.pending", { defaultValue: "Pending" })}
                </span>
                {Number.isFinite(selectedCandidate?.distanceKm) ? (
                  <span className="inline-flex h-9 items-center rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-primary">
                    {t("map.distanceKm", {
                      defaultValue: "{{distance}} km from company",
                      distance: selectedCandidate.distanceKm,
                    })}
                  </span>
                ) : null}
                {selectedCandidate?.verifiedContact ? (
                  <span className="inline-flex h-9 items-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">
                    {t("common.verifiedContact", { defaultValue: "Verified Contact" })}
                  </span>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700">
                    {t("common.unverifiedContact", { defaultValue: "Unverified Contact" })}
                  </span>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default MapPage;


