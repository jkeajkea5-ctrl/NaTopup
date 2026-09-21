1) Main Color Palette

នេះជាពណ៌ដែលស្រដៀងនឹងសក់ក្នុងរូប៖

Primary Blue: #7E8FEF
Soft Blue: #A7B4FF
Primary Pink: #E38AA6
Rose Red Accent: #C95A6E
Violet Blend: #8E78D8
Dark Text / Dark UI: #2A2233
Light Background: #F8F5FB
Soft Border: #E7DCEC
2) Gradient ដែលសាកសម

សក់រូបនេះមាន mix ពណ៌ក្រហមផ្កាឈូក + ខៀវ + violet
ដូច្នេះ gradient សម្រាប់ brand អាចប្រើ៖

Gradient 1 (main brand)
linear-gradient(135deg, #E38AA6 0%, #9B7BEA 45%, #7E8FEF 100%)
Gradient 2 (button / highlight)
linear-gradient(135deg, #C95A6E 0%, #8E78D8 50%, #7E8FEF 100%)
Gradient 3 (hero background)

linear-gradient(180deg, #F8F5FB 0%, #EEE8FF 50%, #EAF0FF 100%)
3) Color Setup សម្រាប់ Website Topup

ខ្ញុំសូមរៀបជាផ្នែកៗឲ្យប្រើងាយ៖

A. Header
Background: #FFFFFF ឬ #F8F5FB
Logo/Text: #2A2233
Active menu: #8E78D8
CTA button: gradient pink-blue
B. Hero Section
Background: gradient ស្រាល
Main title: #2A2233
Subtitle: #6D6478
CTA button:
Primary: #7E8FEF
Hover: #6B7DE2
C. Product Card
Card background: #FFFFFF
Border: #E7DCEC
Price color: #C95A6E
Buy button: #8E78D8
D. Checkout Page
Background: #F8F5FB
Checkout card: #FFFFFF
Total price: #C95A6E
Confirm button: gradient pink-blue
Input focus border: #8E78D8
E. KHQR Checkout Style

KHQR page គួរតែមានអារម្មណ៍ clean + trust + premium

QR card background: #FFFFFF
Top label / badge: #8E78D8
Amount text: #C95A6E
Countdown timer: #7E8FEF
Status success: #34C38F
Status pending: #F0A500
Border: #E7DCEC
4) Recommended UI Role

បើចង់ឲ្យ site មើលទៅស្អាត និង balance ខ្ញុំសូមកំណត់ role បែបនេះ៖

Primary Brand Color → #8E78D8
Secondary Brand Color → #7E8FEF
Accent / CTA → #C95A6E
Soft Highlight → #E38AA6
Background → #F8F5FB
Text Main → #2A2233
Text Secondary → #6D6478
5) CSS Variables Ready to Use

អាចយកទៅដាក់ project បានផ្ទាល់៖

:root {
  --color-primary: #8E78D8;
  --color-primary-2: #7E8FEF;
  --color-secondary: #E38AA6;
  --color-accent: #C95A6E;

  --color-bg: #F8F5FB;
  --color-surface: #FFFFFF;
  --color-border: #E7DCEC;

  --color-text: #2A2233;
  --color-text-muted: #6D6478;

  --color-success: #34C38F;
  --color-warning: #F0A500;
  --color-danger: #E25564;

  --gradient-brand: linear-gradient(135deg, #E38AA6 0%, #8E78D8 45%, #7E8FEF 100%);
  --gradient-button: linear-gradient(135deg, #C95A6E 0%, #8E78D8 50%, #7E8FEF 100%);
}
6) Font Style Recommendation

បើជា website topup theme បែបនេះ ខ្ញុំសូមណែនាំ៖

English UI Font: Inter, Poppins, Manrope
Khmer UI Font: Noto Sans Khmer, Kantumruy Pro
Best combo:
Heading: Poppins
Body: Inter
Khmer: Noto Sans Khmer
7) បើចង់ឲ្យវាមើលទៅ Topup / Gaming ជាងមុន

អាចបន្ថែម style ទៀត៖

Button មាន gradient
Card មាន soft shadow
Icon/glow ពណ៌ violet-blue
Hover effect បន្តិច
Badge “Hot / Popular” ពណ៌ pink-red
Checkout card មូលជ្រុង 16px–20px
8) Final Recommendation

បើចង់យក color website topup ដូចសក់រូបនេះ
ខ្ញុំណែនាំឲ្យប្រើ theme នេះ៖

Main identity = Violet + Blue
Attention / CTA = Pink + Rose Red
Background = Soft white / lavender
Text = Dark plum / deep gray

នេះអាចធ្វើឲ្យ website:

មើលទៅ modern
មានអារម្មណ៍ gaming topup
មាន trust សម្រាប់ checkout
និងស្អាតលើ mobile ផង

បើចង់ ខ្ញុំអាចបន្តជួយអ្នកធ្វើជា៖

Full Design Token
Tailwind color config
Homepage + Header + Checkout color setup
KHQR checkout UI style guide
Figma-style palette document