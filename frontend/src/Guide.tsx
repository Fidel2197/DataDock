import {
  ArrowRight,
  Upload,
  ScanLine,
  ChartNoAxesCombined,
  Download,
  Check,
  Minus,
  BookOpen,
  UserRound,
  Lightbulb,
} from "lucide-react";
import { useState } from "react";
const steps = [
  {
    icon: Upload,
    title: "Bring a spreadsheet",
    short: "Upload",
    description:
      "Save your spreadsheet as a CSV, then drag it into Uploads. DataDock reads the column names and checks every record.",
    tip: "In Excel or Google Sheets, choose Download or Save as → CSV. Use a header row with a unique name for each column.",
  },
  {
    icon: ScanLine,
    title: "Find what needs attention",
    short: "Review",
    description:
      "See missing values, duplicate rows, extra spaces, and unusual numbers. Turn on Issues only and select a flagged row to understand the finding.",
    tip: "A flag is a reason to take a closer look. An unusually large number can still be correct.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "See the bigger picture",
    short: "Explore",
    description:
      "Open Dashboard to compare categories, totals, and averages. Switch columns to explore distributions and completeness.",
    tip: "Charts describe your original upload. Missing and invalid numbers are excluded from numeric totals and averages.",
  },
  {
    icon: Download,
    title: "Keep a cleaner copy",
    short: "Export",
    description:
      "Choose whether to trim spaces, remove duplicate rows, and remove empty rows. Apply your choices, inspect the counts, then download the cleaned CSV.",
    tip: "Your original file is preserved. DataDock does not invent missing values or silently remove unusual numbers.",
  },
];
export default function Guide({
  onUpload,
  onAccount,
}: {
  onUpload: () => void;
  onAccount: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;
  return (
    <>
      <div className="page-heading guide-hero">
        <div>
          <div className="eyebrow">MEET YOUR DATA WORKSPACE</div>
          <h1>Messy spreadsheet. Clear next step.</h1>
          <p>
            DataDock checks your CSV, explains its issues, and helps you turn it
            into a useful report.
          </p>
        </div>
        <span className="guide-emblem">
          <BookOpen size={29} />
        </span>
      </div>
      <section className="guide-tour">
        <div
          className="tour-tabs"
          role="tablist"
          aria-label="Quick-start steps"
        >
          {steps.map((item, i) => (
            <button
              key={item.short}
              id={`step-${i}`}
              role="tab"
              aria-controls="step-panel"
              aria-selected={step === i}
              onClick={() => setStep(i)}
            >
              <span>0{i + 1}</span>
              <item.icon size={19} />
              {item.short}
            </button>
          ))}
        </div>
        <div
          className="tour-content"
          role="tabpanel"
          id="step-panel"
          aria-labelledby={`step-${step}`}
        >
          <div className="tour-symbol">
            <Icon size={46} />
            <span>0{step + 1}</span>
          </div>
          <div>
            <span className="eyebrow">STEP {step + 1} OF 4</span>
            <h2>{current.title}</h2>
            <p>{current.description}</p>
            <div className="guide-tip">
              <Lightbulb size={18} />
              <p>{current.tip}</p>
            </div>
            <button
              className="button primary"
              onClick={() => (step < 3 ? setStep(step + 1) : onUpload())}
            >
              {step < 3 ? "Next step" : "Upload your first file"}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>
      <div className="guide-grid">
        <section className="panel guide-explainer">
          <div className="section-icon">
            <Check size={21} />
          </div>
          <h2>What you get</h2>
          <ul>
            <li>A summary of your dataset’s quality</li>
            <li>Searchable records with clear issue explanations</li>
            <li>Charts that reveal patterns and gaps</li>
            <li>A cleaned CSV and downloadable report</li>
          </ul>
        </section>
        <section className="panel guide-explainer neutral">
          <div className="section-icon">
            <Minus size={21} />
          </div>
          <h2>What stays your decision</h2>
          <ul>
            <li>Whether a surprising value is actually wrong</li>
            <li>What to put in an empty cell</li>
            <li>Which cleanup rules to apply</li>
            <li>How to interpret and use the results</li>
          </ul>
        </section>
      </div>
      <section className="account-invite">
        <div className="section-icon">
          <UserRound size={23} />
        </div>
        <div>
          <h2>A workspace you can come back to.</h2>
          <p>
            You can start without an account. Create one to keep your reports
            together and open them on another device.
          </p>
        </div>
        <button className="button secondary" onClick={onAccount}>
          Your account
          <ArrowRight size={16} />
        </button>
      </section>
      <section className="guide-faq">
        <h2>A few helpful answers</h2>
        {[
          [
            "What is a CSV?",
            "A CSV is a simple spreadsheet file. Each row is a record and each column describes something about it, like a department, amount, or date. Excel and Google Sheets can export CSV files.",
          ],
          [
            "Will this change my original file?",
            "No. DataDock keeps the original upload. Your cleaning choices produce a separate downloadable copy.",
          ],
          [
            "What does the quality percentage mean?",
            "It is the percentage of records with no detected issues. Review suggestions such as outliers count as issues, so this number is a useful starting point rather than a guarantee that the data is correct.",
          ],
          [
            "Can I use DataDock without an account?",
            "Yes. Guest reports belong to this browser. An account lets you keep reports across devices. You can bring your current guest reports into your account when you register or sign in.",
          ],
          [
            "How do I recover an account?",
            "Save the private recovery code shown when you register. If you forget your password, use your username and recovery code to set a new password. No email address is required.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
