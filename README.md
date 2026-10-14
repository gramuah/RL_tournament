# Course about Reinforcement Learning

Repository to prepare the materials for the course about RL

## General Info
Structure of the course: 9 h (Theory sessions) + 6 h (Practical sessions)

For the practical sessions:

1. https://huggingface.co/learn/deep-rl-course/en/unit1/hands-on

2. https://huggingface.co/learn/deep-rl-course/en/unit2/hands-on

3. https://huggingface.co/learn/deep-rl-course/en/unit3/hands-on

In every practical session the students: interact with the RL environments, train their models following a tutorial (colab-based), implement something, submit their final solutions to a challenge.

The practicals will be assessed in a presentation session: defense + oral questions.

## 🏆 Class Competitions & Automated Leaderboard

Students can submit their trained models directly to GitHub! An automated **GitHub Actions CI/CD runner** automatically evaluates submissions under fair, fixed benchmark seeds and publishes live class rankings:

👉 **[View the Live Class Leaderboard (LEADERBOARD.md)](LEADERBOARD.md)** 👈

- 🚀 **Practical 1:** `LunarLander-v3` — [Folder & Submission Guide](submissions/practical1/)
- 🚕 **Practical 2:** `Taxi-v3 / Taxi-v4` — [Folder & Submission Guide](submissions/practical2/)

When you submit via Pull Request, a bot evaluates your agent and leaves a score report on your PR within 2 minutes!

### 🥊 Head-to-Head Agent Duel (Side-by-Side Comparator)

Want to see **who lands faster** in LunarLander or how two agents tackle the exact same challenge?

Run the synchronized head-to-head duel tool locally or directly inside Google Colab:

```bash
# Compare two agents side-by-side with synchronized broadcast video
python tournament/compare.py --practical 1 --agent-a submissions/practical1/demo_student --agent-b baseline_heuristic --episodes 5 --video duel.mp4
```

Or inside your Colab notebook:
```python
import urllib.request
exec(urllib.request.urlopen("https://raw.githubusercontent.com/gramuah/RL_tournament/main/tournament/compare.py").read().decode("utf-8"))

duel_agents(practical_id=1, agent_a="agent.py", agent_b="baseline_heuristic", output_video="duel.mp4")
display_duel("duel.mp4")
```
- **Same seed**: Identical terrain, wind turbulence, and initial conditions.
- **Speed & Score metrics**: Identifies the faster touchdown and action efficiency.
- **Side-by-side replay**: Broadcast HUD with real-time stats and celebration victory screens.

## Schedule

1. October 20 
    
    a. Theory (3h): Slides (Module 1.1 + Module 2.1)
    
2. October 27 

   a. Theory (1h): Slides (Module 2.2)
   b. Practical (2h): Practical 1 

3. November 3
   a. Theory (3h): Slides (Module 2.2, Module 2.3)

4. November 10

   a. Theory (1h): Slides (Module 2.3)
   b. Practical (2h): Practical 2 

5. November 17
   a. Theory (1h): Slides (Module 2.4)
   b. Practical (2h): Final project 

## Evaluation

Final mark: Practical marks (PM) + Oral exam (OE)

PM -> 3 points
OE -> 3.5 (Test + interview) + 3.5 (Final project (1.5) + oral exam (2))


