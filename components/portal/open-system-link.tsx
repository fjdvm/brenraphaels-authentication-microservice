"use client";

import { type MouseEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingCard } from "@/components/ui/loading-card";

const MAX_LOADING_MS = 15_000;

/**
 * Figma "btn/Open CRMS": opens the System's destination in a new tab, showing the "Opening
 * CRMS" loading card here while the System loads. The new tab's load cannot be observed
 * cross-origin, so a no-cors request to the same URL stands in: it settles once the System
 * starts responding. The cap keeps the card from staying up if the System never answers.
 * A click that already opens a new tab or window by itself (modifier keys) shows nothing.
 */
export function OpenSystemLink({ name, url }: { name: string; url: string }) {
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    if (!isOpening) {
      return;
    }

    const controller = new AbortController();
    const stop = () => setIsOpening(false);
    const cap = setTimeout(stop, MAX_LOADING_MS);
    fetch(url, { mode: "no-cors", signal: controller.signal }).then(stop, stop);

    return () => {
      clearTimeout(cap);
      controller.abort();
    };
  }, [isOpening, url]);

  function showLoadingCard(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      setIsOpening(true);
    }
  }

  return (
    <>
      <Button asChild className="px-3.5 py-[9px]" size="cta" variant="identity">
        <a href={url} onClick={showLoadingCard} rel="noopener" target="_blank">
          {/* Figma "btn/Open CREOMS": the label, two spaces, then the arrow glyph. */}
          <span className="whitespace-pre">
            Open {name}
            {"  "}
            <span aria-hidden="true">↗</span>
          </span>
        </a>
      </Button>
      {isOpening ? <LoadingCard title={`Opening ${name}…`} subtitle="Handing your sign-in over securely" /> : null}
    </>
  );
}
