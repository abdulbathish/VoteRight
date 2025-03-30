/**
 * Main JavaScript for Voter ID Card Issuer Application
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Print voter card
  const printCardButton = document.getElementById('print-card');
  if (printCardButton) {
    printCardButton.addEventListener('click', function() {
      window.print();
    });
  }
  
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
  
  // Date of birth field validation
  const dobInput = document.getElementById('dob');
  if (dobInput) {
    dobInput.addEventListener('change', function() {
      const dob = new Date(this.value);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      
      // Check if person meets the minimum age requirement (18 years by default)
      const minAge = 18;
      if (age < minAge) {
        this.setCustomValidity(`You must be at least ${minAge} years old to apply for a voter ID card.`);
      } else {
        this.setCustomValidity('');
      }
    });
  }
  
  // Dynamic table filtering
  const searchInput = document.getElementById('search-voters');
  if (searchInput) {
    searchInput.addEventListener('keyup', function() {
      const filter = this.value.toUpperCase();
      const table = document.getElementById('voters-table');
      const rows = table.getElementsByTagName('tr');
      
      for (let i = 1; i < rows.length; i++) {
        let found = false;
        const cells = rows[i].getElementsByTagName('td');
        
        for (let j = 0; j < cells.length; j++) {
          const cellText = cells[j].textContent || cells[j].innerText;
          
          if (cellText.toUpperCase().indexOf(filter) > -1) {
            found = true;
            break;
          }
        }
        
        rows[i].style.display = found ? '' : 'none';
      }
    });
  }
}); 