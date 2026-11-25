"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { preload } from "react-dom";

import { basePath } from "@/lib/base-path";

/**
 * Home-page hero photograph.
 *
 * Why this is not a plain next/image: the source is a 2400x3600 portrait JPEG. Optimised on demand, the first visitor to a new
 * image size waited for the server to decode and re-encode it, and the hero showed a flat dark gradient until it arrived. So the hero
 * now ships as small pre-cropped WebP files (a landscape crop for wide screens, a portrait crop for phones) served straight from the
 * CDN, preloaded with high priority, over a tiny inline blurred copy of the same photograph. The first paint therefore already shows the
 * photograph's colours, and the sharp image replaces it as soon as it arrives. The slow zoom is CSS (starts at first paint, no JavaScript);
 * only the scroll parallax uses framer-motion, and its initial values are identical on the server and the client, so nothing jumps on hydration.
 */
const BASE = `${basePath}/images/hero`;
const LANDSCAPE = { w1280: `${BASE}/hero-landscape-1280.webp`, w1920: `${BASE}/hero-landscape-1920.webp` };
const PORTRAIT = `${BASE}/hero-portrait-720.webp`;
const BLUR_LANDSCAPE = "data:image/jpeg;base64,/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAUACADASIAAhEBAxEB/8QAGgAAAwADAQAAAAAAAAAAAAAAAAQGAQIDBf/EACUQAAEEAQMCBwAAAAAAAAAAAAEAAgMEEQUhUSNBEhQiMTJhcf/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgT/xAAZEQEAAgMAAAAAAAAAAAAAAAAAARICEVH/2gAMAwEAAhEDEQA/AK5rtlpLYjhAMjw0HlR8F7UmjAmB/Sl9QGoXG9STIHYFRfHqdrLz9cyBglaSRkbpd+rVQ6VpkHT+SgzWvNIA8W3fK5S1bRc4+oZG/wBovAehFK/HumBK/lCFgk2HTP5S8sz+UIQT/9k=";
const BLUR_PORTRAIT = "data:image/jpeg;base64,/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAgABADASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAgQGAQX/xAAiEAABAwQABwAAAAAAAAAAAAABAAIEAwURQRYhIjEyUWH/xAAWAQEBAQAAAAAAAAAAAAAAAAABAAT/xAAYEQEBAAMAAAAAAAAAAAAAAAAAEQITIf/aAAwDAQACEQMRAD8AscoSVz594jQWg1Hg5OklxNDL29WGEdzpVFT9a3trt51ST9SbrO7VUYCJss48ljpZ9rFszHH/2Q==";
const ALT = "Sunrise over paddy fields and coconut palms near Hasiru Nidhi, Karnataka";

export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // React hoists these into <head> (and the Link header): the browser starts the right file before the page's JavaScript has loaded.
  preload(PORTRAIT, { as: "image", media: "(max-width: 767px)", fetchPriority: "high" });
  preload(LANDSCAPE.w1920, { as: "image", imageSrcSet: `${LANDSCAPE.w1280} 1280w, ${LANDSCAPE.w1920} 1920w`, imageSizes: "100vw", media: "(min-width: 768px)", fetchPriority: "high" });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return (
    <div ref={ref} className="absolute inset-0 bg-forest-950">
      <motion.div style={{ y, opacity }} className="absolute inset-0">
        <div className="hero-zoom absolute inset-0">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center [background-image:var(--hero-blur-m)] md:[background-image:var(--hero-blur-d)]"
            style={{ ["--hero-blur-m" as string]: `url(${BLUR_PORTRAIT})`, ["--hero-blur-d" as string]: `url(${BLUR_LANDSCAPE})` }}
          />
          <picture>
            <source media="(min-width: 768px)" srcSet={`${LANDSCAPE.w1280} 1280w, ${LANDSCAPE.w1920} 1920w`} sizes="100vw" type="image/webp" />
            <img src={PORTRAIT} alt={ALT} width={720} height={1440} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          </picture>
        </div>
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/25 to-forest-950/20" />
      <div className="absolute inset-0 bg-forest-950/35 sm:hidden" />
      <div className="absolute inset-0 bg-gradient-to-r from-forest-950/75 via-forest-950/25 to-transparent" />
    </div>
  );
}
