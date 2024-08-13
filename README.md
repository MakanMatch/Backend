<img src="https://github.com/MakanMatch/Backend/assets/53103894/dd621c47-a928-431b-8e59-fe79a5df6c49" height="250px">

![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![Express](https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-52B0E7?style=for-the-badge&logo=Sequelize&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white)
![SQLite](https://img.shields.io/badge/Sqlite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Firebase](https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black)
![AWS](https://img.shields.io/badge/Amazon_AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![Google SMTP](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)
![OpenAI API](https://img.shields.io/badge/ChatGPT-74aa9c?style=for-the-badge&logo=openai&logoColor=white)

# MakanMatch Backend

![Screenshot 2024-08-13 at 12 04 58 AM](https://github.com/user-attachments/assets/b0af8b22-8c62-4df2-80e6-3282552df823)


**MakanMatch is a food-sharing platform deployed by theoretically by the People's Association in Singapore to help reduce food wastage and to foster a sense of community among residents.**

MakanMatch is an ambitious project envisioned and developed by the MakanMatch Team for the Full Stack Development Project module in Year 2 Semester 1 of the Diploma in Information Technology course at Nanyang Polytechnic.

The system (hopefully 😓) should be live at https://makanmatch.com

Hosts can invite fellow guests in their neighbourhood for a meal at their place through this platform, resulting in numerous overall benefits:
- Reducing food wastage
- Fostering a sense of community
- Guests get to have homemade food
- Guests can have food at cheaper prices with fellow neighbours rather than eating out

The increasing food wastage in Singapore and worldwide has raised several environmental concerns; we want to combat the pressing issue effectively through this communal, comprehensive and easy-to-use solution.

Developed with ❤️ by the MakanMatch team, consisting of:
- Prakhar Trivedi ([@Prakhar896](https://github.com/Prakhar896)) - Reservations Management and Overall Lead
- Joshua Long Yu Xuan ([@Sadliquid](https://github.com/Sadliquid)) - Head of Listings Experience
- Joon Jun Han ([@JunHammy](https://github.com/JunHammy)) - Head of Identity Experience
- Lincoln Lim Ken Yang ([@lincoln0623](https://github.com/lincoln0623)) - Head of Platform Quality
- Nicholas Chew Xun Cheng ([@nicholascheww](https://github.com/nicholascheww)) - Head of Platform Communications

# Table of Contents
- [MakanMatch in Images](#makanmatch-in-images)
- [Integrations](#integrations)
- [Backend Technologies](#backend-technologies)
- [Frontend Repository](https://github.com/MakanMatch/Frontend)

# MakanMatch in Images

In MakanMatch, we really emphasised on doing everything customer-first. All designs, features and implementations were curated with the user and their needs in mind.

To enhance the user experience, we tapped on lots of amazing technologies and features to make for a robust, warm and welcoming system.

![Screenshot 2024-08-13 at 12 05 58 AM](https://github.com/user-attachments/assets/6251d63a-1601-4d4b-a134-ff4c35488f3a)

View food listings by hosts in spectacular and beautiful detail. To protect host privacy, the Google Maps Geocoding API is used to approximate the host's location based on their real provided address. After making a reservation, the exact address is revealed to guests.

---

![Screenshot 2024-08-13 at 12 08 10 AM](https://github.com/user-attachments/assets/5038824f-3185-45d8-ad3f-50252bc8bed6)

Through our comprehensive reviews feature, guests can submit reviews for hosts after having had a meal with them. They can provide both a food rating and hygiene rating, helping other guests on the platform be more informed about the host's service standards.

---

![Screenshot 2024-08-13 at 12 10 21 AM](https://github.com/user-attachments/assets/f577cbf9-0987-418e-8f9f-46a733933816)

In the six hour window prior to a listing's time, guests are able to make their payment via the host's PayNoq QR code. Cancellations now are chargeable at rates twice that of the initial reservation cost, but this can be avoided if guests cancel prior to the six hour window.

---

![Screenshot 2024-08-13 at 12 12 25 AM](https://github.com/user-attachments/assets/f90708d3-5d5f-445e-94cf-5eb30b1b3b55)

The My Account page provides a well-rounded set of tools for users to customise their profiles! From uploading a custom profile picture to changing their visible name, creativity flourishes in this page!

---

![Screenshot 2024-08-13 at 12 13 32 AM](https://github.com/user-attachments/assets/62f79c79-b366-4d3e-b636-bb52bad30389)

Hosts are also able to view all of their upcoming listings in a neat calendar UI in the Schedule pane. This helps hosts quickly see when all of their listings are and keep on top of them all.

---

![Screenshot 2024-08-13 at 12 15 39 AM](https://github.com/user-attachments/assets/fa27d37c-4ac4-456d-81be-c50b07e66750)

Real-time messaging features enable hosts and guests to frictionlessly communicate and exchange on the platform, promoting further cultural bonding. Our chat page includes amazing features like activity status visibility (online/offline), message replies and email notifications as well.

---

![Screenshot 2024-08-13 at 12 18 15 AM](https://github.com/user-attachments/assets/13cf1fea-3c39-4859-ab73-34b7954e00ad)

MakanBot, a customer service chatbot fine-tuned for all things MakanMatch, is ready at your service! This intelligent, conversational chatbot can answer any of your urgent queries! The chatbot was built with an integration with the OpenAI APIs.

---

![Screenshot 2024-08-13 at 12 19 46 AM](https://github.com/user-attachments/assets/c0b66383-e779-4726-a474-7d9783569d0c)

Finally, the almighty admin portal! Admins/staff on MakanMatch are able to carry our various comprehensive actions to moderate the site's content and usage. Admins are able to issue warnings to hosts who have poor hygeiene grades, ban users, help users unlock their account and also delete accounts.

Admins can also view a dashboard of essential analytics that are intelligently tracked by the system as it is used.

# Integrations

MakanMatch tactfully inter-operates with various third-party and internal services to deliver a seamless user experience. The project boasts:
- Google Maps & Geocoding APIs with Google Cloud
  - Rendering interactive Google Map embeds to navigate listings in different locations
  - Address validation and coordinate geocoding
  - Approximate address computation and approximate coordinate geo-coding
- Firebase Cloud Storage for efficient image uploads and backups
- AWS Relational Database Service for MySQL
  - Provides a robust and cloud-backed database implementation for MakanMatch
- OpenAI GPT 4.0 API, fine-tuned with runtime prompts

The integrations come together across the system's backend and frontend to deliver a fast, amazing and high-quality user experience.

# Backend Technologies

MakanMatch's backend is stock full of customised layers, services and configurations to empower a robust, error-prone, and powerful foundational architecture for the system.

Some internal services and technologies:
- Sequelize ORM: The backend's runtime is highly configurable, especially the database. With customised code dynamically initialising database operations in coordination with Sequelize, the system's database is guranteed to have high integrity, efficiency and effectiveness.
- `FileManager`: This service works in close co-ordination with Firebase Cloud Storage to simplify file uploads and establishes guranteed consistency with cloud storage. It supports both a local and cloud mode, allowing the system to run entirely independently as well.
- `Analytics`: This extremely powerful service, which layers on top of Sequelize models, is an effective solution to track and analyse different parts of how the system is used. The service intelligently handles periodical persistence to ensure efficiency.
- Authentication System: Through well-placed middleware and JWT management with the `TokenManager` service, the backend ensures the highest standards of security and simplifies the authorisation of requests.
- Middleware: A series of middleware placed intermediately as a request goes through the system ensure data consistency, security and coherent flow.

# Frontend Repository

Haven't seen our beautiful frontend yet? [Check out the dreamy visualisation of this backend server's features right here.](https://github.com/MakanMatch/Frontend)

---

Thank you for checking out MakanMatch! We hope you are motivated to reduce food wastage and say hi to your fellow neighbour! 🥘👋

©️ 2024 The MakanMatch Team. All rights reserved.
