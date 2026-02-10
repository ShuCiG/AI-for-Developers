from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List
from src.crews.base.llm import DEFAULT_LLM
from src.crews.difficulty_classifier_crew.schemas import DifficultyClassificationOutput

@CrewBase
class DifficultyClassifierCrew():
    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def difficulty_classifier(self) -> Agent:
        return Agent(
            config=self.agents_config['difficulty_classifier'],
            llm=DEFAULT_LLM
        )

    @task
    def difficulty_classification_task(self) -> Task:
        return Task(
            config=self.tasks_config['difficulty_classification_task'],
            output_pydantic=DifficultyClassificationOutput
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential
        )