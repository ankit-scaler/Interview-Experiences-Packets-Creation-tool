import Link from "next/link";
import { listPackets } from "@/lib/packets";
import { env } from "@/lib/env";
import { PacketList } from "@/components/packet-list";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PacketsPage() {
  const packets = await listPackets();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Packets</h1>
          <p className="text-sm text-muted-foreground">
            {packets.length} packet{packets.length === 1 ? "" : "s"} · copy a published link to
            share with learners.
          </p>
        </div>
        <Button asChild>
          <Link href="/create">
            <PlusCircle className="h-4 w-4" />
            New packet
          </Link>
        </Button>
      </div>
      <PacketList packets={packets} appUrl={env.appUrl} />
    </div>
  );
}
