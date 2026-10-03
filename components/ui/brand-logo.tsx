import Image from "next/image";

type BrandLogoProps = {
  size: number;
  className?: string;
};

// Decorative: the adjacent "Bren Raphael's Enterprise Suite" text names the brand.
// `unoptimized` because public/logo-mark.png is already resized for these sizes.
export function BrandLogo({ size, className }: BrandLogoProps) {
  return (
    <Image
      alt=""
      className={className}
      height={size}
      src="/logo-mark.png"
      unoptimized
      width={size}
    />
  );
}
