import Link from "next/link";
import { getAdminPosts } from "@/lib/queries/admin";
import { formatDate } from "@/components/content/bits";

export default async function AdminPosts() {
  const posts = await getAdminPosts(200);

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Articles</h1>
        <p className="text-[0.85rem] text-ink-30">{posts.length} shown</p>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[0.85rem]">
          <thead>
            <tr className="border-b border-ink-15 text-left text-[0.72rem] uppercase tracking-wider text-ink-30">
              <th className="pb-3 pr-4 font-medium">Title</th>
              <th className="pb-3 pr-4 font-medium">Topic</th>
              <th className="pb-3 pr-4 font-medium">Type</th>
              <th className="pb-3 pr-4 font-medium">Published</th>
              <th className="pb-3 pr-4 text-right font-medium">Words</th>
              <th className="pb-3 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {posts.map((p) => {
              const cat = p.category as unknown as { name: string } | null;
              return (
                <tr key={p.id as string}>
                  <td className="max-w-[380px] py-3 pr-4">
                    <Link
                      href={`/blog/${p.slug}`}
                      className="line-clamp-1 underline-offset-4 hover:underline"
                    >
                      {p.title as string}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink-50">{cat?.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-ink-30">{p.post_type as string}</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-ink-50">
                    {formatDate(p.published_at as string)}
                  </td>
                  <td className="py-3 pr-4 text-right text-ink-50">
                    {(p.word_count as number)?.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 text-right text-ink-50">{p.quality_score as number}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
