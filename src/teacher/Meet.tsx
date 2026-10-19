import { useState } from "react";
import { Btn, Card, Input, Label, Title } from "../ui";

export function Meet() {
  const [list, setList] = useState([
    {
      t: "Virtual Rehearsal — 27th Sunday",
      w: "2026-10-10T20:00",
      l: "meet.google.com/mml-rhsl-027",
    },
  ]);
  const [t, setT] = useState("Note Reading Class");
  const [w, setW] = useState("2026-10-05T19:00");

  return (
    <>
      <Title kicker="Live sessions" title="Schedule a Google Meet" />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="grid content-start gap-3">
          <Input value={t} onChange={(e) => setT(e.target.value)} />
          <Input
            type="datetime-local"
            value={w}
            onChange={(e) => setW(e.target.value)}
          />
          <Btn
            onClick={() => {
              setList([
                ...list,
                {
                  t,
                  w,
                  l: `meet.google.com/mml-${Math.random().toString(36).slice(2, 6)}-${list.length + 1}`,
                },
              ]);
              alert("Meeting scheduled! Notifications sent to connected student accounts.");
            }}
          >
            Generate Meet link & notify
          </Btn>
          <p className="text-xs text-mute">
            Members are notified via app, SMS, Gmail and Messenger.
          </p>
        </Card>
        <Card>
          <Label>Scheduled</Label>
          <ul className="mt-2 divide-y divide-line">
            {list.map((x) => (
              <li key={x.l} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1">
                  <b>{x.t}</b>
                  <br />
                  <span className="font-mono text-xs text-mute">
                    {new Date(x.w).toLocaleString()} · {x.l}
                  </span>
                </span>
                <Btn
                  variant="ghost"
                  onClick={() => navigator.clipboard?.writeText("https://" + x.l)}
                >
                  Copy link
                </Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}