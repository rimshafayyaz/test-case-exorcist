# Benchmark — Gemini 3 study sample (103 items, 14 test cases)

Detection time: 270 ms, no network, no AI.

| Detector | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| Test Case Exorcist (rules) | 77 | 7 | 30 | 28 | 0.92 | 0.72 | **0.81** |
| Rules + review candidates counted as smells | 84 | 8 | 23 | 28 | 0.91 | 0.79 | **0.84** |
| Gemini 3 (from the study data) | 97 | 9 | 10 | 30 | 0.92 | 0.91 | **0.91** |
| GPT-5.2 (published) | | | | | | | 0.82 |
| Manual Test Sensei (published) | | | | | | | 0.66 |

## Per smell (rules)

| Smell | Baseline labels | TP | FP | FN | Precision | Recall | F1 | Gemini 3 F1 |
|---|---|---|---|---|---|---|---|---|
| AmbiguousTest | 28 | 11 | 2 | 17 | 0.85 | 0.39 | 0.54 | 0.90 |
| ConditionalTest | 7 | 7 | 1 | 0 | 0.88 | 1.00 | 0.93 | 0.71 |
| EagerAction | 22 | 16 | 0 | 6 | 1.00 | 0.73 | 0.84 | 0.98 |
| MisplacedAction | 2 | 2 | 1 | 0 | 0.67 | 1.00 | 0.80 | 1.00 |
| MisplacedPrecondition | 7 | 6 | 0 | 1 | 1.00 | 0.86 | 0.92 | 1.00 |
| MisplacedVerification | 10 | 6 | 1 | 4 | 0.86 | 0.60 | 0.71 | 0.77 |
| UnverifiedAction | 31 | 29 | 2 | 2 | 0.94 | 0.94 | 0.94 | 0.95 |

## Disagreements (rules vs baseline)

- hardware/1474_Speakers#1@0 (action) "Ensure that the sound volume is turned to a reasonable level and that the sound is not muted by clicking on th…" — missed: EagerAction; extra: —
- hardware/1474_Speakers#6@5 (verification) "Sound is played through the speakers without noises or distortions." — missed: AmbiguousTest; extra: —
- image/1303_Live Session#1@11 (action) "Boot up the image" — missed: AmbiguousTest; extra: —
- image/1303_Live Session#3@13 (action) "When ubiquity starts select your language in the left column" — missed: AmbiguousTest; extra: —
- image/1303_Live Session#5@15 (action) "Press "Try FAMILY" and wait for the Live session to start" — missed: MisplacedVerification; extra: —
- hardware/1467_External Microphone#5@21 (action) "Press the ''Super Windows key'', or click the Ubuntu logo in the upper left hand unity panel and search '''Sou…" — missed: EagerAction; extra: —
- hardware/1467_External Microphone#10@26 (verification) "Your voice is played back and and no words have been dropped. (Remember to reset your microphone volume to pre…" — missed: AmbiguousTest; extra: —
- hardware/1482_Wireless Networking#1@27 (action) "Ensure that Network Manager is running and that no networks are currently connected" — missed: EagerAction; extra: —
- hardware/1482_Wireless Networking#8@34 (verification) "A new network interface (e.g. "wlan0") is present and has received an IP address" — missed: AmbiguousTest; extra: —
- hardware/1482_Wireless Networking#9@35 (action) "Run route -n . Note the IP address in the Gateway column. (not "0.0.0.0")" — missed: EagerAction, MisplacedVerification; extra: —
- hardware/1484_Internal Data Card Reader#1@38 (action) "Insert a media card into the reader" — missed: AmbiguousTest; extra: —
- hardware/1484_Internal Data Card Reader#13@50 (action) "Repeat for every type of media supported (e.g. CF, SD, MMC, etc.)" — missed: AmbiguousTest; extra: —
- image/1434_Desktop (Xubuntu)#1@51 (action) "If you installed Xubuntu using English as the default keyboard layout and language, try to add different langu…" — missed: AmbiguousTest, MisplacedPrecondition; extra: UnverifiedAction
- image/1434_Desktop (Xubuntu)#4@54 (action) "Select as many languages as you like, and install them by pressing the Apply Changes button" — missed: EagerAction; extra: —
- image/1434_Desktop (Xubuntu)#5@55 (action) "When they have been successfully installed, log out from the session, and select alternating languages at the …" — missed: MisplacedVerification; extra: —
- image/1448_Unity Lenses#3@59 (action) "Make a search" — missed: AmbiguousTest; extra: —
- image/1448_Unity Lenses#4@60 (verification) "It should impact the result on each category" — missed: AmbiguousTest; extra: —
- image/1448_Unity Lenses#6@62 (action) "Change the filters for each of filter type" — missed: AmbiguousTest; extra: —
- image/1448_Unity Lenses#7@63 (verification) "It should change the results, at least on one category" — missed: AmbiguousTest; extra: —
- image/1628_Xubuntu Post-install#4@67 (verification) "Desktop shows previously started application" — missed: AmbiguousTest; extra: —
- image/1552_EC2CloudImages test#1@68 (action) "'ssh-keyscan -t rsa, dsa $hostname': should differ for each running instance." — missed: AmbiguousTest, UnverifiedAction; extra: —
- image/1552_EC2CloudImages test#4@71 (action) "Attempt to ssh to each running instance as 'root@${hostname}'." — missed: AmbiguousTest; extra: —
- image/1658_Xubuntu Core Upgrade taskesel#1@76 (action) "Install the core task in a current release." — missed: AmbiguousTest; extra: —
- image/1658_Xubuntu Core Upgrade taskesel#5@80 (verification) "This should upgrade without installing any metapackages." — missed: —; extra: AmbiguousTest
- image/1442_Mythbuntu Frontend#1@81 (action) "Go though the Ubiquity install as you would any other install. Most options won't matter for this testcase, bu…" — missed: EagerAction; extra: —
- image/1454_Dist-Upgrade#2@88 (action) "Install all updates available for the release you want to upgrade by running update-manager. Click Check if an…" — missed: UnverifiedAction; extra: ConditionalTest, MisplacedVerification
- image/1454_Dist-Upgrade#3@89 (action) "Watch it update, noting any errors" — missed: MisplacedVerification; extra: AmbiguousTest, UnverifiedAction
- packages/1423_LibreOffice#1@92 (action) "Open a Word document format .doc or .docx and save it in ODF format." — missed: AmbiguousTest; extra: —
- packages/1423_LibreOffice#4@95 (verification) "After the closing and opening, do the contents look the same in the different file formats?" — missed: —; extra: MisplacedAction
