import { SiteHeader } from "@/components/content/SiteHeader";
import { Footer } from "@/components/site/Footer";

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
