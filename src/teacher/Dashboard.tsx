import { Card, Label, Title } from "../ui";

export function Dashboard() {
  return (
    <>
      <Title
        kicker="Overview"
        title="Teacher Dashboard"
        sub="Welcome to your class portal."
      />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <Label>Total Students</Label>
          <p className="mt-2 font-display text-4xl grad-text">24</p>
        </Card>
        <Card>
          <Label>Active Modules</Label>
          <p className="mt-2 font-display text-4xl grad-text">12</p>
        </Card>
        <Card>
          <Label>Pending Assessments</Label>
          <p className="mt-2 font-display text-4xl grad-text">5</p>
        </Card>
      </div>
    </>
  );
}