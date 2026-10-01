import Image from "next/image";

export default function BrandLogo() {
  return (
    <span className="brand-logo">
      <Image
        src="/brand/hebrewtales-mark.svg"
        width={32}
        height={29}
        alt=""
        aria-hidden="true"
        className="brand-logo-mark"
      />
      <span className="brand-logo-name">HebrewTales</span>
    </span>
  );
}
