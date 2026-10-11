import { redirect } from "next/navigation";

export default async function JoinCirclePage({
  params,
}: {
  params: Promise<{ circleAddress: string }>;
}) {
  const { circleAddress } = await params;
  redirect(`/?circle=${encodeURIComponent(circleAddress)}`);
}
