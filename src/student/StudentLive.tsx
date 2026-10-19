import { Video } from "lucide-react";
import { Btn, Card, Title } from "../ui";

export function StudentLive() {
  const s = [
    {
      t: "Note Reading Class",
      w: "Today · 7:00 PM",
      by: "Sis. Ethyl",
      live: true,
    },
    {
      t: "Virtual Rehearsal — 27th Sunday",
      w: "Fri, Oct 10 · 8:00 PM",
      by: "Bro. Jet",
    },
  ];
  return (
    <>
      <Title kicker="Virtual classroom" title="Live Sessions" />
      <div className="grid gap-4">
        {s.map((x) => (
          <Card key={x.t} className="flex flex-wrap items-center gap-5">
            <div
              className={`grid h-14 w-14 place-items-center rounded-2xl ${x.live ? "grad text-white" : "bg-p1-soft text-p1"}`}
            >
              <Video className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-display text-xl">{x.t}</p>
              <p className="text-mute">
                {x.w} · {x.by}
              </p>
            </div>
            {x.live ? (
              <a
                href="https://meet.google.com"
                target="_blank"
                rel="noreferrer"
              >
                <Btn className="px-8 py-3 text-base cursor-pointer">
                  Join on Google Meet
                </Btn>
              </a>
            ) : (
              <Btn variant="ghost" className="cursor-pointer">
                Add to calendar
              </Btn>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}