# Benchmark — Gemini 3 study sample (103 items, 14 test cases)

Detection time: 188 ms, no network, no AI.

| Detector | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| Test Case Exorcist (rules) | 61 | 18 | 46 | 29 | 0.77 | 0.57 | **0.66** |
| Rules + review candidates counted as smells | 65 | 21 | 42 | 28 | 0.76 | 0.61 | **0.67** |
| Gemini 3 (from the study data) | 97 | 9 | 10 | 30 | 0.92 | 0.91 | **0.91** |
| GPT-5.2 (published) | | | | | | | 0.82 |
| Manual Test Sensei (published) | | | | | | | 0.66 |

## Per smell (rules)

| Smell | Baseline labels | TP | FP | FN | Precision | Recall | F1 | Gemini 3 F1 |
|---|---|---|---|---|---|---|---|---|
| AmbiguousTest | 28 | 4 | 0 | 24 | 1.00 | 0.14 | 0.25 | 0.90 |
| ConditionalTest | 7 | 5 | 1 | 2 | 0.83 | 0.71 | 0.77 | 0.71 |
| EagerAction | 22 | 10 | 0 | 12 | 1.00 | 0.45 | 0.63 | 0.98 |
| MisplacedAction | 2 | 2 | 1 | 0 | 0.67 | 1.00 | 0.80 | 1.00 |
| MisplacedPrecondition | 7 | 3 | 0 | 4 | 1.00 | 0.43 | 0.60 | 1.00 |
| MisplacedVerification | 10 | 6 | 5 | 4 | 0.55 | 0.60 | 0.57 | 0.77 |
| UnverifiedAction | 31 | 31 | 11 | 0 | 0.74 | 1.00 | 0.85 | 0.95 |

## Disagreements (rules vs baseline)

- hardware/1474_Speakers#1@0 (action) "Ensure that the sound volume is turned to a reasonable level and that the sound is not muted by clicking on th…" — missed: AmbiguousTest, EagerAction; extra: UnverifiedAction
- hardware/1474_Speakers#4@3 (action) "Select either of the .ogg files" — missed: AmbiguousTest; extra: —
- hardware/1474_Speakers#6@5 (verification) "Sound is played through the speakers without noises or distortions." — missed: AmbiguousTest; extra: —
- hardware/1474_Speakers#7@6 (action) "Adjust the volume with the Volume Control applet. Verify that the audio volume changes." — missed: EagerAction; extra: UnverifiedAction
- hardware/1474_Speakers#8@7 (action) "Right-click the Volume Control applet and check Mute" — missed: EagerAction; extra: —
- hardware/1474_Speakers#10@9 (action) "Right-click the Volume Control applet and uncheck Mute" — missed: EagerAction; extra: —
- image/1303_Live Session#1@11 (action) "Boot up the image" — missed: AmbiguousTest; extra: —
- image/1303_Live Session#3@13 (action) "When ubiquity starts select your language in the left column" — missed: AmbiguousTest; extra: —
- image/1303_Live Session#5@15 (action) "Press "Try FAMILY" and wait for the Live session to start" — missed: EagerAction, MisplacedVerification; extra: —
- hardware/1467_External Microphone#3@19 (action) "Open ''Sound Preferences'' or ''Sound Setting''." — missed: ConditionalTest; extra: —
- hardware/1467_External Microphone#4@20 (action) "Go to the ''Input'' tab and ensure that the ''Input'' volume of the microphone is set to an appropriate level …" — missed: EagerAction; extra: UnverifiedAction
- hardware/1467_External Microphone#5@21 (action) "Press the ''Super Windows key'', or click the Ubuntu logo in the upper left hand unity panel and search '''Sou…" — missed: ConditionalTest, EagerAction; extra: —
- hardware/1467_External Microphone#7@23 (action) "Talk briefly into the microphone." — missed: AmbiguousTest; extra: —
- hardware/1467_External Microphone#10@26 (verification) "Your voice is played back and and no words have been dropped. (Remember to reset your microphone volume to pre…" — missed: AmbiguousTest; extra: —
- hardware/1482_Wireless Networking#1@27 (action) "Ensure that Network Manager is running and that no networks are currently connected" — missed: EagerAction; extra: UnverifiedAction
- hardware/1482_Wireless Networking#3@29 (action) "Ensure wireless is enabled" — missed: MisplacedPrecondition; extra: MisplacedVerification, UnverifiedAction
- hardware/1482_Wireless Networking#4@30 (action) "After approximately 30 seconds, open the network manager" — missed: AmbiguousTest; extra: —
- hardware/1482_Wireless Networking#8@34 (verification) "A new network interface (e.g. "wlan0") is present and has received an IP address" — missed: AmbiguousTest; extra: —
- hardware/1482_Wireless Networking#9@35 (action) "Run route -n . Note the IP address in the Gateway column. (not "0.0.0.0")" — missed: EagerAction, MisplacedVerification; extra: —
- hardware/1484_Internal Data Card Reader#1@38 (action) "Insert a media card into the reader" — missed: AmbiguousTest; extra: —
- hardware/1484_Internal Data Card Reader#13@50 (action) "Repeat for every type of media supported (e.g. CF, SD, MMC, etc.)" — missed: AmbiguousTest; extra: —
- image/1434_Desktop (Xubuntu)#1@51 (action) "If you installed Xubuntu using English as the default keyboard layout and language, try to add different langu…" — missed: AmbiguousTest, MisplacedPrecondition; extra: UnverifiedAction
- image/1434_Desktop (Xubuntu)#4@54 (action) "Select as many languages as you like, and install them by pressing the Apply Changes button" — missed: AmbiguousTest, EagerAction; extra: —
- image/1434_Desktop (Xubuntu)#5@55 (action) "When they have been successfully installed, log out from the session, and select alternating languages at the …" — missed: MisplacedVerification; extra: —
- image/1448_Unity Lenses#3@59 (action) "Make a search" — missed: AmbiguousTest; extra: —
- image/1448_Unity Lenses#4@60 (verification) "It should impact the result on each category" — missed: AmbiguousTest; extra: —
- image/1448_Unity Lenses#6@62 (action) "Change the filters for each of filter type" — missed: AmbiguousTest; extra: —
- image/1448_Unity Lenses#7@63 (verification) "It should change the results, at least on one category" — missed: AmbiguousTest; extra: —
- image/1628_Xubuntu Post-install#1@64 (action) "Open any application and suspend machine" — missed: AmbiguousTest; extra: —
- image/1628_Xubuntu Post-install#4@67 (verification) "Desktop shows previously started application" — missed: AmbiguousTest; extra: —
- image/1552_EC2CloudImages test#1@68 (action) "'ssh-keyscan -t rsa, dsa $hostname': should differ for each running instance." — missed: AmbiguousTest; extra: —
- image/1552_EC2CloudImages test#4@71 (action) "Attempt to ssh to each running instance as 'root@${hostname}'." — missed: AmbiguousTest; extra: —
- image/1552_EC2CloudImages test#6@73 (action) "Run 'apt-get update' and verify that an ec2 mirror is used." — missed: EagerAction; extra: —
- image/1658_Xubuntu Core Upgrade taskesel#1@76 (action) "Install the core task in a current release." — missed: AmbiguousTest; extra: —
- image/1658_Xubuntu Core Upgrade taskesel#3@78 (action) "Make sure xubuntu-desktop is not installed." — missed: MisplacedPrecondition; extra: MisplacedVerification, UnverifiedAction
- image/1442_Mythbuntu Frontend#1@81 (action) "Go though the Ubiquity install as you would any other install. Most options won't matter for this testcase, bu…" — missed: AmbiguousTest, EagerAction; extra: —
- image/1442_Mythbuntu Frontend#4@84 (action) "Once the machine boots up, it should boot into the frontend." — missed: —; extra: UnverifiedAction
- image/1454_Dist-Upgrade#2@88 (action) "Install all updates available for the release you want to upgrade by running update-manager. Click Check if an…" — missed: —; extra: ConditionalTest, MisplacedVerification
- image/1454_Dist-Upgrade#3@89 (action) "Watch it update, noting any errors" — missed: MisplacedVerification; extra: UnverifiedAction
- packages/1423_LibreOffice#1@92 (action) "Open a Word document format .doc or .docx and save it in ODF format." — missed: AmbiguousTest; extra: —
- packages/1423_LibreOffice#4@95 (verification) "After the closing and opening, do the contents look the same in the different file formats?" — missed: —; extra: MisplacedAction
- packages/1424_Nautilus#1@96 (action) "Please ensure the Nautilus window is running and the Nautilus window is focused" — missed: —; extra: MisplacedVerification, UnverifiedAction
- packages/1424_Nautilus#1@100 (action) "Please ensure the Nautilus window is running and the Nautilus window is focused" — missed: MisplacedPrecondition; extra: MisplacedVerification, UnverifiedAction
