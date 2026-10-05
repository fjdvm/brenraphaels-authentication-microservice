import Image from "next/image";

import logoMark from "@/public/logo-mark.png";

type BrandLogoProps = {
  size: number;
  className?: string;
};

// Decorative: the adjacent "Bren Raphael's Enterprise Suite" text names the brand.
export function BrandLogo({ size, className }: BrandLogoProps) {
  return (
    <Image
      alt=""
      className={className}
      height={size}
      src={logoMark}
      width={size}
    />
  );
}
