const checkoutStatus = document.getElementById("checkoutStatus");
const checkoutIntro = document.getElementById("checkoutIntro");
const checkoutPlans = document.getElementById("checkoutPlans");
const checkoutButtons = document.querySelectorAll(".checkout-button");
const checkoutEnvironmentBadge = document.getElementById("checkoutEnvironmentBadge");
const checkoutFootnote = document.getElementById("checkoutFootnote");

const isLocalCheckout =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

const BILLING_API_BASE_URL = isLocalCheckout
    ? "http://127.0.0.1:8765"
    : "https://runeradar-production.up.railway.app";

const query = new URLSearchParams(window.location.search);
const checkoutToken = query.get("checkout_token") || "";
const transactionId = query.get("_ptxn") || "";
const pageState = query.get("state") || "";

let checkoutContext = null;
let paddleEnvironment = "";
let checkoutCompleted = false;

function environmentLabel() {
    return paddleEnvironment === "sandbox" ? "Sandbox" : "Live";
}

function applyEnvironmentCopy() {
    const sandbox = paddleEnvironment === "sandbox";

    if (checkoutEnvironmentBadge) {
        checkoutEnvironmentBadge.textContent = sandbox
            ? "Paddle Sandbox"
            : "Secure live checkout";
    }

    if (checkoutFootnote) {
        checkoutFootnote.textContent = sandbox
            ? "This is Paddle Sandbox. No real payment is processed. After a successful test checkout, return to RuneLite and refresh your account."
            : "Payments are securely processed by Paddle. After checkout, return to RuneLite and refresh your account. Pro activates after RuneRadar receives Paddle's verified confirmation.";
    }
}

function initializePaddle(config) {
    if (!config || !["sandbox", "live"].includes(config.environment)) {
        throw new Error("RuneRadar returned an invalid Paddle environment.");
    }

    const expectedPrefix = config.environment === "sandbox" ? "test_" : "live_";
    if (!String(config.client_side_token || "").startsWith(expectedPrefix)) {
        throw new Error("RuneRadar returned a token for the wrong Paddle environment.");
    }

    paddleEnvironment = config.environment;
    applyEnvironmentCopy();

    // Paddle.js defaults to production. Its documented environment setter is
    // intentionally used only for Sandbox.
    if (paddleEnvironment === "sandbox") {
        Paddle.Environment.set("sandbox");
    }

    Paddle.Initialize({
        token: config.client_side_token,
        eventCallback: handlePaddleEvent
    });
}

function showStatus(message, kind = "info") {
    if (!checkoutStatus) {
        return;
    }

    checkoutStatus.textContent = message;
    checkoutStatus.className = `checkout-status checkout-status-${kind}`;
}

function setButtonsDisabled(disabled) {
    checkoutButtons.forEach((button) => {
        button.disabled = disabled;
    });
}

function showMissingSession() {
    if (checkoutIntro) {
        checkoutIntro.textContent =
            "Start this checkout from Get Pro inside RuneLite so the subscription can be linked to your signed-in account.";
    }

    showStatus("No valid RuneRadar checkout session was supplied.", "error");
}

function successUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("state", "success");
    return url.toString();
}

function handlePaddleEvent(event) {
    if (!event || !event.name) {
        return;
    }

    if (event.name === "checkout.completed") {
        checkoutCompleted = true;
        showStatus(
            `${environmentLabel()} checkout completed. Paddle is confirming your subscription. Return to RuneLite and refresh your account.`,
            "success"
        );
        setButtonsDisabled(true);
    }

    if (event.name === "checkout.closed") {
        if (checkoutCompleted) {
            return;
        }

        showStatus(
            "Checkout closed. Nothing was changed; you can choose a plan whenever you are ready.",
            "info"
        );
        setButtonsDisabled(false);
    }
}

async function loadCheckout() {
    if (pageState === "success") {
        if (checkoutIntro) {
            checkoutIntro.textContent = "Your checkout completed successfully.";
        }
        showStatus(
            "Return to RuneLite and refresh your account. Pro becomes active after the verified Paddle webhook arrives.",
            "success"
        );
        return;
    }

    if (pageState === "cancel") {
        if (checkoutIntro) {
            checkoutIntro.textContent = "The checkout was canceled.";
        }
        showStatus("No subscription was created and your account was not changed.", "info");
        return;
    }

    if (!checkoutToken && !transactionId) {
        showMissingSession();
        return;
    }

    if (!window.Paddle) {
        showStatus("Paddle Checkout could not be loaded. Please try again.", "error");
        return;
    }

    try {
        if (transactionId) {
            const configResponse = await fetch(
                `${BILLING_API_BASE_URL}/billing/config`,
                {
                    method: "GET",
                    headers: { "Accept": "application/json" }
                }
            );
            const config = await configResponse.json();

            if (!configResponse.ok || config.status !== "ok") {
                throw new Error(config.message || `Checkout failed with HTTP ${configResponse.status}`);
            }

            initializePaddle(config);
            if (checkoutIntro) {
                checkoutIntro.textContent = "Loading your secure Paddle payment page…";
            }
            showStatus("Secure payment page is loading.", "info");
            return;
        }

        const response = await fetch(
            `${BILLING_API_BASE_URL}/billing/context?checkout_token=${encodeURIComponent(checkoutToken)}`,
            {
                method: "GET",
                headers: { "Accept": "application/json" }
            }
        );
        const data = await response.json();

        if (!response.ok || data.status !== "ok") {
            throw new Error(data.message || `Checkout failed with HTTP ${response.status}`);
        }

        checkoutContext = data;
        initializePaddle(checkoutContext);

        if (checkoutIntro) {
            checkoutIntro.textContent =
                `Choose a plan for ${checkoutContext.email}.`;
        }
        if (checkoutPlans) {
            checkoutPlans.hidden = false;
        }
        showStatus(`Secure ${environmentLabel()} checkout is ready.`, "success");
    }
    catch (error) {
        console.error("RuneRadar checkout error:", error);
        showStatus(
            error && error.message
                ? error.message
                : "Checkout could not be prepared. Open Get Pro again in RuneLite.",
            "error"
        );
    }
}

checkoutButtons.forEach((button) => {
    button.addEventListener("click", () => {
        if (!checkoutContext) {
            return;
        }

        const priceId = button.dataset.plan === "yearly"
            ? checkoutContext.yearly_price_id
            : checkoutContext.monthly_price_id;

        setButtonsDisabled(true);
        showStatus(`Opening Paddle ${environmentLabel()} checkout…`, "info");

        Paddle.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customer: { email: checkoutContext.email },
            customData: {
                runeradar_checkout_token: checkoutContext.checkout_token
            },
            settings: {
                displayMode: "overlay",
                theme: "dark",
                locale: "en",
                allowLogout: false,
                successUrl: successUrl()
            }
        });
    });
});

loadCheckout();
