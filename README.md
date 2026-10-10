# Technician Exam Practice

A dependency-free, installable web app using the supplied 2026-2030 Technician Class question pool. Each test draws 35 questions at random, reveals the correct answer after a selection, and shows a score out of 35 with a missed-question review.

## Run locally

Serve this folder with any static web server. Opening `index.html` directly as a `file://` URL will prevent the browser from loading the question bank and service worker.

The app caches its files, question bank, and diagrams after the first visit; supported browsers can then install it from their browser menu.

## Publish on GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the app when changes are pushed to `main`. It publishes the app files and `data/` question bank and figures, not this README or the source DOCX.

For the first deployment, open the repository's **Settings > Pages** and select **GitHub Actions** as the build and deployment source. After the workflow succeeds, the app will be available at `https://madsquirrel113.github.io/AmatuerTechnicianStudyTool/` and can be opened on phones, tablets, and Chromebooks.

The NCVEC Question Pool Committee states that it releases the [2026-2030 Technician Class question pool into the public domain](https://ncvec.org/index.php/2026-2030-technician-question-pool). The source syllabus DOCX is kept in the project root; extracted question data is in `data/questions.json`.