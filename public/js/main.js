// Main JavaScript for Voter ID System

document.addEventListener('DOMContentLoaded', () => {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Form validation
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });

    // Image preview for photo upload
    const photoInput = document.getElementById('photo');
    if (photoInput) {
        photoInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                const preview = document.getElementById('photoPreview');
                
                if (preview) {
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    // Copy Voter ID to clipboard
    const copyButtons = document.querySelectorAll('.copy-id');
    if (copyButtons) {
        copyButtons.forEach(button => {
            button.addEventListener('click', function() {
                const idText = this.getAttribute('data-id');
                navigator.clipboard.writeText(idText).then(() => {
                    // Change button text temporarily
                    const originalText = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        this.innerHTML = originalText;
                    }, 2000);
                });
            });
        });
    }

    // Print Voter ID Card
    const printButton = document.getElementById('printCard');
    if (printButton) {
        printButton.addEventListener('click', function() {
            window.print();
        });
    }
}); 