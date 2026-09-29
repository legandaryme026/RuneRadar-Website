const upgradeButton = document.getElementById("upgradeButton");

if (upgradeButton) {
    upgradeButton.addEventListener("click", () => {
        window.location.href = "checkout.html";
    });
}

const contactForm = document.getElementById("contactForm");
const contactSubmitButton = document.getElementById("contactSubmitButton");
const contactStatus = document.getElementById("contactStatus");

const CONTACT_API_URL =
    "https://runeradar-production.up.railway.app/contact";

if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!contactSubmitButton || !contactStatus) {
            return;
        }

        const formData = new FormData(contactForm);

        const payload = {
            name: String(formData.get("name") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            category: String(formData.get("category") || "").trim(),
            subject: String(formData.get("subject") || "").trim(),
            message: String(formData.get("message") || "").trim(),
            website: String(formData.get("website") || "").trim()
        };

        if (
            !payload.name ||
            !payload.email ||
            !payload.category ||
            !payload.subject ||
            !payload.message
        ) {
            contactStatus.textContent =
                "Please complete all required fields.";

            contactStatus.className =
                "contact-status contact-status-error";

            return;
        }

        contactSubmitButton.disabled = true;
        contactSubmitButton.textContent = "Sending...";

        contactStatus.textContent = "";
        contactStatus.className = "contact-status";

        try {
            const response = await fetch(
                CONTACT_API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Contact request failed with HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (data.status !== "ok") {
                throw new Error(
                    "RuneRadar contact API returned an error."
                );
            }

            contactForm.reset();

            contactStatus.textContent =
                "Message sent. Thanks — we'll get back to you as soon as possible.";

            contactStatus.className =
                "contact-status contact-status-success";
        }
        catch (error) {
            console.error(
                "RuneRadar contact form error:",
                error
            );

            contactStatus.textContent =
                "Your message could not be sent right now. Please try again later.";

            contactStatus.className =
                "contact-status contact-status-error";
        }
        finally {
            contactSubmitButton.disabled = false;
            contactSubmitButton.textContent = "Send message";
        }
    });
}
