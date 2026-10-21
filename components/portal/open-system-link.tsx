"use client";

import { ArrowUpRight } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingCard } from "@/components/ui/loading-card";

/**
 * Figma "btn/Open CRMS": opens the System's destination, showing the "Opening CRMS" loading
 * card while the browser leaves for it. A click that opens a new tab or window leaves this
 * page where it is, so it shows nothing.
 */
export function OpenSystemLink({ name, url }: { name: string; url: string }) {
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    // Back from the System, the browser may restore this page as it was left: card showing.
    function resetOnRestore(event: PageTransitionEvent) {
      if (event.persisted) {
        setIsOpening(false);
      }
    }

    window.addEventListener("pageshow", resetOnRestore);
    return () => window.removeEventListener("pageshow", resetOnRestore);
  }, []);

  function showLoadingCard(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      setIsOpening(true);
    }
  }

  return (
    <>
      <Button asChild className="px-[18px] py-[11px] font-semibold" size="cta" variant="identity">
        <a href={url} onClick={showLoadingCard}>
          Open {name}
          <ArrowUpRight aria-hidden="true" />
        </a>
      </Button>
      {isOpening ? <LoadingCard title={`Opening ${name}…`} subtitle="Handing your sign-in over securely" /> : null}
    </>
  );
}
