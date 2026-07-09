// Knowledge base for ACA (American Creativity Academy) WhatsApp policy bot.
// Structured as small, individually-tagged SECTIONS (not one giant blob).
// server.js scores each section against the incoming question's keywords and
// only sends the top-matching sections to Claude — this is what cuts token
// usage per query instead of always sending everything.
//
// To add content (e.g. from your website), push new objects into SECTIONS
// with the same shape: { id, title, keywords: [...], content: "..." }

const SECTIONS = [
  {
    id: "tuition_fees",
    title: "Annual tuition fees by grade",
    keywords: ["tuition", "fee", "fees", "cost", "price", "how much", "kg", "grade", "annual"],
    content: `Annual Tuition Fees (2026-2027):
- KG.1 & 2: KD 2,427
- Grade 1-5: KD 3,528
- Grade 6-8: KD 3,981
- Grade 9-12: KD 4,516
Fees can increase if the Ministry of Education approves an increment.`,
  },
  {
    id: "installments",
    title: "Installment schedule and amounts",
    keywords: ["installment", "installments", "payment schedule", "due date", "when to pay", "first installment", "second installment", "third installment"],
    content: `Installment due dates:
- First Installment: 1st week of September - 40% of total fees
- Second Installment: 1st week of January - 30% of total fees
- Third Installment: 1st week of April - 30% of total fees

Amounts by grade (First / Second / Third / Total, in KD):
- KG.1&2: 971 / 728 / 728 / 2,427
- Grade 1-5: 1,412 / 1,058 / 1,058 / 3,528
- Grade 6-8: 1,593 / 1,194 / 1,194 / 3,981
- Grade 9-12: 1,808 / 1,354 / 1,354 / 4,516`,
  },
  {
    id: "payment_methods",
    title: "How to pay",
    keywords: ["pay", "payment method", "edunation", "cashier", "cash", "how to pay", "online payment"],
    content: `Payments can be made by logging into the Edunation account or through the school's cashier.
Cash payments are NOT accepted.`,
  },
  {
    id: "registration_fee",
    title: "Registration fee rules",
    keywords: ["registration fee", "reregistration", "re-enrollment fee", "KD 100", "100 KD", "non-refundable"],
    content: `Registration fee: KD 100 (non-refundable), paid upon registration or re-enrollment.
It is part of the tuition fee and is deducted from the first installment.`,
  },
  {
    id: "reenrollment_rules",
    title: "Re-enrollment requirements",
    keywords: ["re-enroll", "reenroll", "re-enrollment", "renew", "next year", "previous balance", "outstanding fees"],
    content: `To re-enroll for 2026-2027, the Second Installment of the current year (2025-2026) must be paid in full.
A student cannot re-enroll if there are due tuition fees pending from previous years.
ACA will not allow re-enrollment or reserve seats unless the parent provides a clearance letter or original receipts proving all previous and current year balances are settled.`,
  },
  {
    id: "report_cards",
    title: "Report cards",
    keywords: ["report card", "grades", "results", "transcript"],
    content: `Report cards are electronic (online); fourth quarter report cards are also distributed physically.
Report cards are only released if payments are up to date.`,
  },
  {
    id: "transportation_uniform",
    title: "Transportation and uniform",
    keywords: ["transportation", "bus", "uniform", "transport"],
    content: `The school does NOT offer transportation service. Parents may contract directly with a bus company of their choice, under their own responsibility.
All students must wear the ACA uniform, available for purchase.`,
  },
  {
    id: "withdrawal_policy",
    title: "Withdrawal policy",
    keywords: ["withdraw", "withdrawal", "leave school", "cancel enrollment", "refund"],
    content: `Withdrawal rules:
1. Registration fee is non-refundable.
2. Students who paid the KD 100 registration fee but never attended will not be refunded.
3. Withdrawal from the first school day to December 31: 40% of tuition fees due (registration fee included).
4. Withdrawal from January 1 to March 31: 70% of tuition fees due (registration fee included).
5. Withdrawal from April 1 onward: full tuition fees due.
6. A student who withdraws and later wants to return in the same academic year is registered as a new student under the financial policy.`,
  },
  {
    id: "delayed_enrollment",
    title: "Delayed enrollment discount",
    keywords: ["delayed enrollment", "late enrollment", "join late", "second semester discount", "discount"],
    content: `No discount for delayed enrollment during the first semester.
Students enrolled during the second semester are eligible for a 20% discount.`,
  },
  {
    id: "handbook_photos",
    title: "Parent/Student Handbook and photo policy",
    keywords: ["handbook", "photo", "photos", "social media", "instagram", "pictures"],
    content: `Parents are responsible for reviewing the Parent/Student Handbook at www.aca.edu.kw.
ACA has the right to post students' photos on social media and school publications unless the guardian notifies the school in writing in advance to opt out.
ACA reserves the right to adjust the policy under any circumstance.`,
  },
  {
    id: "code_of_conduct",
    title: "Parents' code of conduct",
    keywords: ["code of conduct", "behavior", "conduct", "complaint", "feedback"],
    content: `The Academy welcomes discussions, questions, suggestions, and constructive criticism.
Parents are expected to adhere to the code of conduct in the Parent/Student handbook.`,
  },
  {
    id: "attendance",
    title: "Attendance and absence rules",
    keywords: ["attendance", "absence", "absent", "late", "miss school", "first day"],
    content: `Accepted students must attend within the first four days of the official start of the school year.
Parents must notify ACA in writing in advance if their child will be late for the start of the academic year.
On the fifth day of unnotified absence, the child is dropped from school registration and the seat is given to another child.`,
  },
  {
    id: "general_conditions",
    title: "General financial policy conditions",
    keywords: ["sign", "signature", "father", "mother", "divorce", "custody", "death", "sponsor", "employer", "communication", "sms", "clearance letter", "liability"],
    content: `Key general conditions of the financial policy:
- Signing the policy (or paying any fee/accepting online) means full agreement to all its terms.
- Either parent signing is considered eligible and binds both to the terms.
- If a sponsor/employer fails to pay, the father is responsible for completing payment.
- Re-enrollment or fee payment alone is NOT proof previous balances are cleared — only an official receipt or clearance letter proves that.
- Official communication is via SMS to the father's phone or the registered email; parents must keep contact info updated.
- Per Ministry of Education guidelines, the father has sole authority to sign registration forms, except in case of death (death certificate required) or divorce (custody documents required).
- Parents are fully responsible for the accuracy of information/documents they provide.`,
  },
  {
    id: "special_needs",
    title: "Special educational needs policy",
    keywords: ["special needs", "dyslexia", "adhd", "add", "autism", "learning difficulty", "disability", "mental health", "support services"],
    content: `ACA does NOT have specialized support services or facilities for students with special needs (e.g. dyslexia, ADHD/ADD, autism spectrum conditions, long-term conditions that interfere with the educational environment).
If a student is suspected of requiring special educational needs the school cannot provide, the school may conduct in-house screening or require outside testing, and has the right to ask the student to exit if behavioral problems interfere with the educational process.
Parents must inform the registrar of any special needs at the time of application.`,
  },
  {
    id: "documentation",
    title: "Required documentation for registration",
    keywords: ["documents", "documentation", "records", "medical records", "prior school", "transfer"],
    content: `Parents must submit correct information and all documentation to the Registrar's office, including prior school records, academic history, and medical records where applicable.
If documents are withheld or altered, ACA may suspend or terminate enrollment WITHOUT refund of the registration deposit or any fee paid.`,
  },
  {
    id: "admission_process",
    title: "Admission and entrance test process",
    keywords: ["admission", "apply", "application", "entrance test", "assessment", "age scale", "seat reservation", "new student"],
    content: `The school reserves a seat for a child only after reviewing the appropriate age (ACA's age scale) and the child passing the entrance test/assessment, and after payment of the registration fee (KD 100, non-refundable, credited toward tuition).
There is no separate published "test fee" beyond the KD 100 registration fee — for confirmation of any additional assessment charges, contact the school directly.`,
  },
  {
    id: "application_form_fields",
    title: "What the application form collects",
    keywords: ["application form", "form fields", "what information", "sibling", "emergency contact"],
    content: `The Application Form collects: campus applied for (Hawally/Salmiya), grade, student details (name, nationality, religion, gender, DOB, passport/civil ID, address), siblings already at ACA, an emergency contact (not the parents), and both parents' personal/contact information.`,
  },
  {
    id: "campus_contact",
    title: "Campuses and contact information",
    keywords: ["contact", "phone", "number", "address", "location", "hawally", "salmiya", "website", "campus"],
    content: `ACA has two campuses: Hawally and Salmiya.
Contact: Hawally 22673333, Salmiya 25731535.
Website: www.aca.edu.kw | Instagram: @acaschools_official
Over 25 years in education; accredited by CIS, MSA-CESS, and authorized by the IB. Subsidiary of Sama Educational Co.`,
  },
  {
    id: "kg_evaluation",
    title: "Kindergarten evaluation process",
    keywords: ["kg evaluation", "kindergarten assessment", "pre-assessment", "kg team"],
    content: `After applying, the child is invited to a pre-assessment, evaluated independently by the KG team across language, social, emotional, fine/gross motor skills, and general knowledge. Results are shared through the registration department.`,
  },
  {
    id: "kg_curriculum",
    title: "Kindergarten curriculum",
    keywords: ["kg curriculum", "phonics", "kindergarten subjects", "arabic lesson", "islamic studies"],
    content: `KG Department (PreK-KG2) focuses on Phonics, Math, Language Arts, Social Studies, and Science through active, hands-on learning. KG1 and KG2 also have a daily Arabic lesson and a weekly Islamic studies session.`,
  },
  {
    id: "kg_requirements",
    title: "Kindergarten requirements",
    keywords: ["toilet trained", "kg requirements", "speak english", "kg1", "kg2", "prek"],
    content: `KG.1 and KG.2 students are required to speak in English.
All KG students must be toilet trained from their first day. If a child repeatedly cannot use the bathroom independently, the school may suspend or terminate enrollment WITHOUT refund of the deposit or fees already paid.`,
  },
  {
    id: "kg_hours",
    title: "Kindergarten school hours",
    keywords: ["kg hours", "school hours", "dismissal time", "pick up", "aftercare"],
    content: `PreK and KG1 hours: 7:15 AM to 12:30 PM. KG2 hours: 7:15 AM to 2:15 PM.
An aftercare program exists for PreK and KG1. There is NO after-school supervision following KG2 dismissal — parents must arrange timely pickup.`,
  },
  {
    id: "kg_communication",
    title: "Kindergarten parent communication",
    keywords: ["myu", "app", "newsletter", "communication app", "teacher updates"],
    content: `ACA uses the "MyU" app to communicate with parents (updates, photos, newsletters). A seat is reserved for a KG child only after payment is received AND all personal/academic files are completed.`,
  },
];

// Always included on every request regardless of the question — small and
// cheap, but useful as a safety net for greetings or vague questions.
const ALWAYS_INCLUDE_IDS = ["campus_contact"];

module.exports = { SECTIONS, ALWAYS_INCLUDE_IDS };
