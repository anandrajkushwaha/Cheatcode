import { getCategories } from "@/lib/queries/admin";
import { PostEditor } from "@/components/admin/PostEditor";

export default async function NewPost() {
  const categories = await getCategories();
  return <PostEditor post={null} categories={categories} />;
}
