#  Social-AI 
### Smart Social Media Management Platform

**Social-AI** is a robust, full-stack application designed to automate and optimize social media workflows. By leveraging Artificial Intelligence and direct API integrations, the platform helps users generate high-quality content and manage their Instagram presence seamlessly.

##  Key Features
* **AI Content Generation:** Uses **OpenAI** to generate creative post captions and ideas based on user input.
* **Instagram Integration:** Direct connection via **Instagram Graph API** to fetch data and manage media.
* **Secure Authentication:** User login and protection using **Google OAuth 2.0**.
* **Real-time Dashboard:** A modern UI to track social media performance.

##  Tech Stack

### Frontend
* **React** (Functional Components, Hooks)
* **TypeScript** for type-safe, maintainable code.

### Backend
* **Node.js** & Express.
* **MongoDB** (Database) for flexible data storage.
* **OpenAI API** for intelligent content creation.
* **Instagram Graph API** for social media connectivity.
* **Google Auth** for secure user sessions.

### Environment Variables
To run this project, you will need to add the following variables to your `.env` file in the backend folder:

* `GOOGLE_ANALYTICS_PROPERTY_ID` - Your GA4 Property ID.
* `GOOGLE_CLIENT_EMAIL` - Service account email for Google APIs.
* `GOOGLE_PRIVATE_KEY` - Service account private key.
* `MONGODB_URI` - Connection string for your MongoDB database.
* `OPENAI_API_KEY` - Your OpenAI API secret key.
* `INSTAGRAM_APP_ID` - Your Meta/Instagram App ID.

## Getting Started
To get a local copy up and running, follow these simple steps:

 **Clone the repository:**
   git clone [https://github.com/edenaharon1/social-AI.git](https://github.com/edenaharon1/social-AI.git)

Setup Backend: Go to the backend folder, install dependencies, and create a .env file:
cd backend
npm install
# Add your environment variables to .env
npm run dev

Setup Frontend: Open a new terminal, go to the frontend folder, and run:
cd frontend
npm install
npm run dev

**Testing**
This project includes automated tests for the backend. To run them:
cd backend
npm test

Project Structure & My Contribution
This was a collaborative final project. My primary focus included:

Developing the Backend API endpoints and database schema.

Developing the Backend API endpoints and designing MongoDB data models using TypeScript.

Integrating the Google Auth and OpenAI services.

👥 Team Members
Sapir Indig
Korin Leck
Daniel Vasyanovich
לk
