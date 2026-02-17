from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from src.crews.base.llm import DEFAULT_LLM
from src.crews.vocabulary_crew.schemas import WordCardOutput


@CrewBase
class VocabularyCrew:
    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def vocabulary_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config["vocabulary_specialist"],
            llm=DEFAULT_LLM,
        )

    @task
    def vocabulary_task(self) -> Task:
        return Task(
            config=self.tasks_config["vocabulary_task"],
            output_pydantic=WordCardOutput,
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
        )
