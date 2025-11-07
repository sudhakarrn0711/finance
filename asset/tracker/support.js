function styleModernDropdownAnimatedBorder(dropdownId, speedFactor = 1) {
    const dd = document.getElementById(dropdownId);
    if (!dd) return;

    // Hide native dropdown
    dd.style.display = "none";

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    wrapper.style.borderRadius = "25px";
    wrapper.style.padding = "2px";
    wrapper.style.background = "linear-gradient(90deg, #9a22f6, #f96fdc, #9a22f6)";
    wrapper.style.backgroundSize = "300% 300%";
    wrapper.style.cursor = "pointer";
    wrapper.style.fontFamily = "inherit";
    dd.parentNode.insertBefore(wrapper, dd);

    // Display element
    const display = document.createElement("div");
    display.textContent = dd.options[dd.selectedIndex]?.text || "";
    display.style.background = "#fff";
    display.style.borderRadius = "23px";
    display.style.padding = "10px 40px 10px 15px";
    display.style.fontSize = "14px";
    display.style.color = "#333";
    display.style.userSelect = "none";
    display.style.position = "relative";
    display.style.transition = "box-shadow 0.3s ease";
    wrapper.appendChild(display);

    // Arrow SVG
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("width", "14");
    arrow.setAttribute("height", "14");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.style.position = "absolute";
    arrow.style.right = "12px";
    arrow.style.top = "50%";
    arrow.style.transform = "translateY(-50%) rotate(0deg)";
    arrow.style.transformOrigin = "center";
    arrow.style.transition = "transform 0.25s ease, stroke 0.3s ease";
    arrow.style.pointerEvents = "none";
    display.appendChild(arrow);

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", "6 9 12 15 18 9");
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "#9a22f6");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    arrow.appendChild(polyline);

    // Option list
    const optionsList = document.createElement("div");
    optionsList.className = "custom-dropdown-options";
    optionsList.style.position = "absolute";
    optionsList.style.top = "100%";
    optionsList.style.left = "0";
    optionsList.style.width = "100%";
    optionsList.style.background = "#fff";
    optionsList.style.borderRadius = "10px";
    optionsList.style.marginTop = "5px";
    optionsList.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    optionsList.style.maxHeight = "150px";
    optionsList.style.overflowY = "auto";
    optionsList.style.zIndex = "999";
    optionsList.style.display = "none";
    wrapper.appendChild(optionsList);

    // Fill options
    Array.from(dd.options).forEach(option => {
        const optDiv = document.createElement("div");
        optDiv.textContent = option.text;
        optDiv.style.padding = "8px 15px";
        optDiv.style.cursor = "pointer";
        optDiv.style.transition = "background 0.2s ease, color 0.2s ease";
        optDiv.addEventListener("mouseover", () => {
            optDiv.style.background = "linear-gradient(90deg, #9a22f6, #f96fdc)";
            optDiv.style.color = "#fff";
        });
        optDiv.addEventListener("mouseout", () => {
            optDiv.style.background = "#fff";
            optDiv.style.color = "#333";
        });
        optDiv.addEventListener("click", () => {
            dd.value = option.value;
            display.firstChild.textContent = option.text;
            optionsList.style.display = "none";
            arrow.style.transform = "translateY(-50%) rotate(0deg)";
            polyline.setAttribute("stroke", "#9a22f6");
            dd.dispatchEvent(new Event("change"));
        });
        optionsList.appendChild(optDiv);
    });

    let gradientPos = 0;
    let gradientAnimId = null;

    function animateGradient() {
        gradientPos = (gradientPos + (1 * speedFactor)) % 360;
        wrapper.style.background = `linear-gradient(${gradientPos}deg, #9a22f6, #f96fdc, #9a22f6)`;
        const hue = (gradientPos % 360);
        polyline.setAttribute("stroke", `hsl(${hue}, 85%, 55%)`);
        gradientAnimId = requestAnimationFrame(animateGradient);
    }

    // Toggle open/close
    display.addEventListener("click", () => {
        const isOpen = optionsList.style.display === "block";
        document.querySelectorAll(".custom-dropdown-options").forEach(el => el.style.display = "none");
        if (!isOpen) {
            optionsList.style.display = "block";
            arrow.style.transform = "translateY(-50%) rotate(180deg)";
            display.style.boxShadow = "0 4px 14px rgba(154, 34, 246, 0.5)";
            cancelAnimationFrame(gradientAnimId);
            animateGradient();
        } else {
            optionsList.style.display = "none";
            arrow.style.transform = "translateY(-50%) rotate(0deg)";
            display.style.boxShadow = "none";
            cancelAnimationFrame(gradientAnimId);
            polyline.setAttribute("stroke", "#9a22f6");
            wrapper.style.background = "linear-gradient(90deg, #9a22f6, #f96fdc, #9a22f6)";
        }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            optionsList.style.display = "none";
            arrow.style.transform = "translateY(-50%) rotate(0deg)";
            display.style.boxShadow = "none";
            cancelAnimationFrame(gradientAnimId);
            polyline.setAttribute("stroke", "#9a22f6");
            wrapper.style.background = "linear-gradient(90deg, #9a22f6, #f96fdc, #9a22f6)";
        }
    });
}

// NEW: Style text, date, and number inputs
function styleModernTextbox(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.style.padding = "10px 15px";
    input.style.borderRadius = "25px";
    input.style.border = "2px solid transparent";
    input.style.background = "linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #9a22f6, #f96fdc) border-box";
    input.style.outline = "none";
    input.style.fontSize = "14px";
    input.style.transition = "box-shadow 0.3s ease";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    if (input.type === "date") {
        input.style.paddingRight = "35px";
    }

    input.addEventListener("focus", () => {
        input.style.boxShadow = "0 4px 14px rgba(154, 34, 246, 0.5)";
    });
    input.addEventListener("blur", () => {
        input.style.boxShadow = "none";
    });
}

// Example usage
document.addEventListener("DOMContentLoaded", function () {
    styleModernDropdownAnimatedBorder("annualReportYear", 1.5);
    styleModernDropdownAnimatedBorder("reportYear", 1.5);
    styleModernDropdownAnimatedBorder("reportMonth", 1.5);
    styleModernTextbox("txAmount");
    styleModernTextbox("txDesc");
    
});



