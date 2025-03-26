function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

function validateDomain(domain) {
    const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
    return domainRegex.test(domain);
}

function validateIpAddress(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

function validateApiKey(apiKey) {
    const apiKeyRegex = /^[a-zA-Z0-9]{37}$/;
    return apiKeyRegex.test(apiKey);
}

function validateForm() {
    //const email = document.getElementById('email').value;
    const apiKey = document.getElementById('apiKey').value;
    const ipAddresses = document.getElementById('ipAddresses').value;
    const domains = document.getElementById('domains').value.split("\n");

    /*if (!validateEmail(email)) {
        showAlert('❌ Невірний формат email!', 'danger');
        return false;
    }*/

    if (!validateApiKey(apiKey)) {
        showAlert('❌ Невірний API-ключ! Він має містити 37 символи.', 'danger');
        return false;
    }

    if (!ipAddresses.split(',').every(ip => validateIpAddress(ip.trim()))) {
        showAlert('❌ Невірний формат IP-адреси! Використовуйте формат: 192.168.1.1', 'danger');
        return false;
    }

    for (let domain of domains) {
        if (!validateDomain(domain.trim())) {
            showAlert(`❌ Невірний формат домену: ${domain}`, 'danger');
            return false;
        }
    }

    return true;
}

document.getElementById('cloudflareForm').addEventListener('submit', function(event) {
    event.preventDefault();  // Останавливаем стандартную отправку формы

    if (!validateForm()) {
        console.log("⛔ Форма содержит ошибки, отправка отменена.");
        return;  // Прерываем выполнение, если есть ошибки
    }

    // Если валидация прошла, вручную отправляем форму
    this.submit();  // Отправляем форму
});
