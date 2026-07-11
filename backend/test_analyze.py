import requests
import sys

def test_determinism():
    url = "http://localhost:8000/api/analyze"
    # Create a dummy PDF file for testing
    from reportlab.pdfgen import canvas
    c = canvas.Canvas("test_resume.pdf")
    c.drawString(100, 750, "John Doe")
    c.drawString(100, 730, "Software Engineer")
    c.drawString(100, 710, "Email: john@example.com | Phone: 123-456-7890 | github.com/johndoe")
    c.drawString(100, 690, "Summary: Experienced software engineer with 5 years building scalable APIs.")
    c.drawString(100, 670, "Skills: Python, FastAPI, React, Node.js")
    c.drawString(100, 650, "Experience: Software Engineer at Tech Corp")
    c.drawString(100, 630, "- Built scalable APIs handling 1000 requests per second.")
    c.drawString(100, 610, "- Reduced latency by 50% using Redis.")
    c.drawString(100, 590, "Education: BS Computer Science, University of XYZ")
    c.save()

    scores = []
    
    print("Testing general mode 3 times...")
    for i in range(3):
        with open("test_resume.pdf", "rb") as f:
            files = {"resume": ("test_resume.pdf", f, "application/pdf")}
            res = requests.post(url, files=files)
            if res.status_code != 200:
                print(f"Error {res.status_code}: {res.text}")
                continue
            data = res.json()
            det_score = data["scores"]["deterministic_rule_score"]
            ai_score = data["scores"]["ai_review_score"]
            scores.append(det_score)
            print(f"Run {i+1} - Deterministic Score: {det_score}, AI Score: {ai_score}")

    if len(set(scores)) == 1:
        print(f"Determinism Test PASSED: All scores identical ({scores[0]}).")
    else:
        print(f"Determinism Test FAILED: Scores varied: {scores}")

    print("\nTesting job_match mode...")
    with open("test_resume.pdf", "rb") as f:
        files = {"resume": ("test_resume.pdf", f, "application/pdf")}
        data = {"job_description": "Looking for a Software Engineer with Python and FastAPI experience."}
        res = requests.post(url, files=files, data=data)
        if res.status_code == 200:
            res_data = res.json()
            print("Job Match Mode Result:")
            print(f"Deterministic: {res_data['scores']['deterministic_rule_score']}")
            print(f"AI: {res_data['scores']['ai_review_score']}")
            print(f"Job Match: {res_data['scores']['job_match_score']}")
            print("PASSED Job Match test.")
        else:
            print(f"FAILED Job Match test: {res.status_code} {res.text}")

if __name__ == "__main__":
    test_determinism()
