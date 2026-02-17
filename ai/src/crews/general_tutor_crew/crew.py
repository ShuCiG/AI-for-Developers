from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from src.crews.base.llm import DEFAULT_LLM
from src.crews.general_tutor_crew.schemas import GeneralTutorOutput


@CrewBase
class GeneralTutorCrew:
    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def general_tutor(self) -> Agent:
        return Agent(
            config=self.agents_config["general_tutor"],
            llm=DEFAULT_LLM,
        )

    @task
    def general_tutor_task(self) -> Task:
        return Task(
            config=self.tasks_config["general_tutor_task"],
            output_pydantic=GeneralTutorOutput,
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
        )
