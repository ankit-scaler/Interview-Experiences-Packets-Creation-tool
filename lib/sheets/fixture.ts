import type { Track } from "@prisma/client";
import type { RepoRow } from "@/lib/generation/types";

/**
 * Small in-memory stand-in for the question repo, used only when Google Sheets
 * credentials are absent (local demo / tests). Mirrors the real column shape.
 */
const RAW: Record<Track, Omit<RepoRow, "rowIndex" | "tab" | "dateAddedTs">[]> = {
  ACADEMY: [
    row("Flipkart", "Application Engineer 2", "R1", "Passed", "Given a string containing only bracket characters ()[]{}, determine whether the string is valid. Problem Link: Valid Parentheses – LeetCode", "Stacks"),
    row("Flipkart", "Application Engineer 2", "R1", "Passed", "Given an array arr[] of length N, find the length of the longest subarray consisting of consecutive numbers in increasing order.", "Arrays"),
    row("Flipkart", "Application Engineer 2", "R2", "Passed", "Explain the meaning of each keyword in public static void main(String[] args)", "Java Basics"),
    row("Flipkart", "Application Engineer 2", "R2", "Passed", "What is the difference between INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL OUTER JOIN, CROSS JOIN, and SELF JOIN in SQL? In what scenarios would you use each type of join?", "Joins"),
    row("Flipkart", "Application Engineer 2", "R2", "Passed", "What are the different access modifiers in Java and how does each control visibility within packages and subclasses?", "Java Basics"),
    row("Flipkart", "Application Engineer 2", "R3", "Rejected", "Can you introduce yourself and share a brief overview of your background?", "Behavioral"),
  ],
  DEVOPS: [
    row("Genzeon", "DevOps/Systems Engineer", "R1 - Technical", "Rejected", "Explain Jenkins from scratch and how pipelines are built.", "CI/CD"),
    row("Genzeon", "DevOps/Systems Engineer", "R1 - Technical", "Rejected", "What is scripting and how do you reduce Docker image size?", "Docker"),
    row("Genzeon", "DevOps/Systems Engineer", "R1 - Technical", "Rejected", "Explain the state file in Terraform.", "Terraform"),
  ],
  AIML: [
    row("Wissen technology", "Python AI Developer", "R1 - Assessment", "Rejected", "Solve a coding problem related to Generative AI involving LangChain or LangGraph, focusing on embedding models and context filtering.", "RAG"),
    row("Wissen technology", "Python AI Developer", "R1 - Assessment", "Rejected", "Write a SQL query involving three tables using Common Table Expressions (CTEs) to solve a data retrieval problem.", "CTEs"),
  ],
  DSML: [
    row("Indium Software", "Data Analyst", "R1 - Assessment", "Rejected", "You are given three tables: Users, Loads, and Bids. Write a query to find the latest bid made for each load and compute the total bidding value.", "SQL"),
    row("Indium Software", "Data Analyst", "R2", "Rejected", "Walk through your approach to de-duplicating two large transaction tables where one has a primary key and the other does not.", "Data Cleaning"),
  ],
};

function row(
  company: string,
  role: string,
  round: string,
  status: string,
  question: string,
  relatedTopic: string,
): Omit<RepoRow, "rowIndex" | "tab" | "dateAddedTs"> {
  return {
    company,
    role,
    round,
    status,
    isRelevant: true,
    question,
    solution: "",
    relatedModule: relatedTopic,
    relatedTopic,
    dateAdded: "01-Sep-2026",
    jobId: "FIX",
    userId: "FIX",
    email: "demo.learner@example.com",
  };
}

export function fixtureRows(track: Track): RepoRow[] {
  return RAW[track].map((r, i) => ({
    ...r,
    rowIndex: i + 2,
    tab: `fixture:${track}`,
    dateAddedTs: new Date(2026, 8, 1).getTime(),
  }));
}
