import { Card, Label } from "../ui";

export function Gospel() {
  return (
    <Card className="bg-white">
      <div className="relative">
        <Label>Daily Gospel · Awit at Papuri</Label>
        <p className="mt-3 font-display text-lg leading-snug">
          "Increase our faith." — Luke 17:5–10
        </p>
        <p className="mt-2 text-sm text-mute">
          Faith the size of a mustard seed is enough. Today, sing not to be
          heard, but so that others may pray.
        </p>
        <a
          href="https://www.awitatpapuri.com"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-p1 hover:underline cursor-pointer"
        >
          Read full reflection →
        </a>
      </div>
    </Card>
  );
}