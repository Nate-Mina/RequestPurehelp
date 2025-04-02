document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('help-form');
    const submitButton = document.getElementById('submit-button');
    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.spinner');

    const validateForm = () => {
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const description = document.getElementById('problem-description').value.trim();
        const address = document.getElementById('address').value.trim();
        const bookingTime = document.getElementById('booking-time').value;

        const errors = [];
        
        if (firstName.length < 2) errors.push('First name must be at least 2 characters');
        if (lastName.length < 2) errors.push('Last name must be at least 2 characters');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email address');
        if (!/^[0-9\s\-()+]{10,}$/.test(phone)) errors.push('Please enter a valid phone number');
        if (description.length < 10) errors.push('Problem description must be at least 10 characters');
        if (address.length < 5) errors.push('Address must be at least 5 characters');
        if (!bookingTime) errors.push('Please select a preferred booking time');
        
        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) errors.push('Please complete the reCAPTCHA verification');

        return errors;
    };

    const setLoading = (isLoading) => {
        submitButton.disabled = isLoading;
        buttonText.textContent = isLoading ? 'Sending...' : 'Get Help Now';
        spinner.classList.toggle('hidden', !isLoading);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        try {
            setLoading(true);
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            if (!response.ok) {
                throw new Error('Submission failed');
            }

            const responseHtml = await response.text();
            document.body.innerHTML = responseHtml;
        } catch (error) {
            console.error('Error:', error);
            alert('Sorry, there was an error submitting your request. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    initializeGoogleSignIn();
});

// Add Google Sign-In functionality
function initializeGoogleSignIn() {
    gapi.load('auth2', () => {
        const auth2 = gapi.auth2.init({
            client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your Google Client ID
        });

        const googleSignInButton = document.getElementById('google-signin-button');
        googleSignInButton.addEventListener('click', () => {
            auth2.signIn().then(googleUser => {
                const idToken = googleUser.getAuthResponse().id_token;
                console.log('Google ID Token:', idToken);

                // Send the token to the server for verification
                fetch('/google-login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ idToken }),
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Google login failed');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Server response:', data);
                    alert('Google login successful!');
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Google login failed. Please try again.');
                });
            });
        });
    });
}
