import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

/**
 * Every page outside the sign-in wall wears the same header and the same
 * footer as the landing page. Content pages used to have a header of their
 * own — shorter, blurred, with a different set of links — so walking from the
 * home page to a tool or to Insights swapped the navigation out under the
 * visitor. One nav, one footer, right up to the point somebody signs in.
 */
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
