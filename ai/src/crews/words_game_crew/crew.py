from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from src.crews.base.llm import DEFAULT_LLM
from src.crews.words_game_crew.schemas import WordsGameOutput


@CrewBase
class WordsGameCrew:
    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def words_game_writer(self) -> Agent:
        return Agent(
            config=self.agents_config["words_game_writer"],
            llm=DEFAULT_LLM,
        )

    @task
    def words_game_task(self) -> Task:
        return Task(
            config=self.tasks_config["words_game_task"],
            output_pydantic=WordsGameOutput,
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
        )
