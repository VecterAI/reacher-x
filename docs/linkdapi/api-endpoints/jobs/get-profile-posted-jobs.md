# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Profile's Posted Jobs

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fposted-by-profile&folder=Jobs)

1 credit

Get currect Jobs posted by Given Profile Urn

`/api/v1/jobs/posted-by-profile?profileUrn=ACoAAAeWVC4BM8_bz8jN04nDpIZtNNB8_tjZN6w&start=0&count=25`

### Query Parameters

`profileUrn`

Required

string

Example:`ACoAAAeWVC4BM8_bz8jN04nDpIZtNNB8_tjZN6w`

`start`

integer

Example:`0`

`count`

integer

Example:`25`

### Response Schema

Field

Type

Description

`jobs`

array<object>

List of job listings

`id`

string

utc-millisec

Unique identifier for this resource

`title`

string

Title of the job, post, or article

`description`

string

style

Detailed description or summary

`jobState`

string

`listedAt`

integer

Timestamp

`workRemoteAllowed`

boolean

`workplaceType`

string

`location`

object

Geographic location information

`id`

string

utc-millisec

Unique identifier for this resource

`defaultLocalizedName`

string

`abbreviatedLocalizedName`

string

`company`

object

Company name or details

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Company name

`url`

string

uri

Company page URL

`logoURL`

string

uri

URL of the company or entity logo

`total`

integer

Total number of results available

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

jobs:

\[0\]:

id:"4300993904"

title:"Senior Software Engineer - ML Infrastructure"

description:"Plaid is evolving into an AI-first company, where data and machine learning are the key enablers of smarter, more secure insight products built on top of Plaid’s vast financial data network. The Machine Learning Infrastructure team sits at the center of this transformation. We build the platforms that enable model developers to experiment, train, deploy, and monitor machine learning systems reliably and at scale — from feature stores and pipelines, to deployment frameworks and inference tooling.<br>We are in the midst of a pivotal shift: replacing legacy systems with a modern feature store, and establishing a standardized ML Ops “golden path.” Our mission is to enable Plaid’s product teams to move faster with trustworthy insights, deploy models with confidence, and unlock the next generation of AI-powered financial experiences.<br>As a Senior Software Engineer on the Machine Learning Infrastructure team, you will design, build, and operate the systems that power machine learning across Plaid. You will apply your deep technical expertise to create scalable, reliable, and secure ML platforms, and collaborate closely with ML product teams to accelerate the delivery of ML &amp; AI-powered products.<br>This is a highly technical, hands-on role where you’ll contribute to core infrastructure, influence architectural direction, and mentor peers while helping to define the “golden path” for ML development and deployment at Plaid.<br><strong>Responsibilities<br></strong><ul><li>Design and implement large-scale ML infrastructure, including feature stores, pipelines, deployment tooling, and inference systems.</li><li>Drive the rollout of Plaid’s next-generation feature store to improve reliability and velocity of model development.</li><li>Help define and evangelize an ML Ops “golden path” for secure, scalable model training, deployment, and monitoring.</li><li>Ensure operational excellence of ML pipelines and services, including reliability, scalability, performance, and cost efficiency.</li><li>Collaborate with ML product teams to understand requirements and deliver solutions that accelerate experimentation and iteration.</li><li>Contribute to technical strategy and architecture discussions within the team.</li><li>Mentor and support other engineers through code reviews, design discussions, and technical guidance.<br></li></ul><strong>Qualifications<br></strong><ul><li>5+ years of industry experience as a software engineer, with strong focus on ML/AI infrastructure or large-scale distributed systems.</li><li>Hands-on expertise in building and operating ML platforms (e.g., feature stores, data pipelines, training/inference frameworks).</li><li>Proven experience delivering reliable and scalable infrastructure in production.</li><li>Solid understanding of ML Ops concepts and tooling, as well as best practices for observability, security, and reliability.</li><li>Strong communication skills and ability to collaborate across teams.</li><li>\[Nice to have\] Experience with ML Ops tools such as MLFlow, SageMaker, or model registries.</li><li>\[Nice to have\] Exposure to modern AI infrastructure environments (LLMs, real-time inference, agentic models).</li><li>\[Nice to have\] Background in scaling ML infrastructure in fast-paced product environments.<br></li></ul>$180,000 - $270,000 a year<br>The target base salary for this position ranges from $180,000/year to $270,000/year in Zone 1. The target base salary will vary based on the job's location.<br><strong>Our Geographic Zones Are As Follows<br></strong>Zone 1 - New York City and San Francisco Bay Area<br>Zone 2 - Los Angeles, Seattle, Washington D.C.<br>Zone 3 - Austin, Boston, Denver, Houston, Portland, Sacramento, San Diego<br>Zone 4 - Raleigh-Durham and all other US cities<br>Additional compensation in the form(s) of equity and/or commission are dependent on the position offered. Plaid provides a comprehensive benefit plan, including medical, dental, vision, and 401(k). Pay is based on factors such as (but not limited to) scope and responsibilities of the position, candidate's work experience and skillset, and location. Pay and benefits are subject to change at any time, consistent with the terms of any applicable compensation or benefit plans."

jobState:"LISTED"

listedAt:1768994340000

workRemoteAllowed:false

workplaceType:"Hybrid"

location:

id:"102277331"

defaultLocalizedName:"San Francisco, California, United States"

abbreviatedLocalizedName:"San Francisco, CA"

company:

id:"2684737"

name:"Plaid"

url:"https://www.linkedin.com/company/plaid-/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQET1PssqfCU5g/company-logo\_400\_400/B4EZarmEzJGYAg-/0/1746635608257/plaid\_\_logo?e=1771459200&v=beta&t=VrlilCOQnXqD5ckAMEQYxMCexYnhPq8nCtoRvMPzXzE"

\[1\]:

id:"4299714070"

title:"Engineering Manager - Machine Learning Infrastructure"

description:"Plaid is evolving into an AI-first company, where data and machine learning are the key enablers of smarter, more secure insight products built on top of Plaid’s vast financial data network. The Machine Learning Infrastructure team sits at the center of this transformation. We build the platforms that enable model developers to experiment, train, deploy, and monitor machine learning systems reliably and at scale — from feature stores and pipelines, to deployment frameworks and inference tooling. We are in the midst of a pivotal shift: replacing legacy systems with a modern feature store, and establishing a standardized ML Ops “golden path.” Our mission is to enable Plaid’s product teams to move faster with trustworthy insights, deploy models with confidence, and unlock the next generation of AI-powered financial experiences.<br>As the Engineering Manager for Machine Learning Infrastructure, you will be responsible for guiding a senior engineering team through the design, delivery, and operation of Plaid’s ML infrastructure. We are looking for a leader who combines deep technical expertise in ML infrastructure with proven experience scaling and managing senior engineering teams. You’ll ensure clarity of execution, help your team deliver high-quality systems, and partner closely with ML product teams to meet their needs. This role is execution-driven: you will translate strategy into action, remove blockers, and build a culture of ownership and technical excellence.<br><strong>Responsibilities<br></strong><ul><li>Lead and support the ML Infra team, driving project execution and ensuring delivery on key commitments.</li><li>Build and launch Plaid’s next-generation feature store to improve reliability and velocity of model development.</li><li>Define and drive adoption of an ML Ops “golden path” for secure, scalable model training, deployment, and monitoring.</li><li>Ensure operational excellence of ML pipelines, deployment tooling, and inference systems.</li><li>Partner with ML product teams to understand requirements and deliver solutions that accelerate model development and iteration.</li><li>Recruit, mentor, and develop engineers, fostering a collaborative and high-performing team culture.<br></li></ul><strong>Qualifications<br></strong><ul><li>8–10 years of experience in ML infrastructure, including direct hands-on expertise as an engineer, IC/TL.</li><li>2+ years of experience managing infrastructure or ML platform engineers.</li><li>Proven experience delivering and operating ML or AI infrastructure at scale.</li><li>Solid technical depth across ML/AI infrastructure domains (e.g., feature stores, pipelines, deployment, inference, observability).</li><li>Demonstrated ability to drive execution on complex technical projects with cross-team stakeholders.</li><li>Strong communication and stakeholder management skills.<br></li></ul>$241,200 - $400,000 a year<br>The target base salary for this position ranges from $241,200 a year to $400,000year in Zone 1. The target base salary will vary based on the job's location.<br><strong>Our Geographic Zones Are As Follows<br></strong>Zone 1 - New York City and San Francisco Bay Area Zone<br>Additional compensation in the form(s) of equity and/or commission are dependent on the position offered. Plaid provides a comprehensive benefit plan, including medical, dental, vision, and 401(k). Pay is based on factors such as (but not limited to) scope and responsibilities of the position, candidate's work experience and skillset, and location. Pay and benefits are subject to change at any time, consistent with the terms of any applicable compensation or benefit plans."

jobState:"LISTED"

listedAt:1768821144000

workRemoteAllowed:false

workplaceType:"Hybrid"

location:

id:"102277331"

defaultLocalizedName:"San Francisco, California, United States"

abbreviatedLocalizedName:"San Francisco, CA"

company:

id:"2684737"

name:"Plaid"

url:"https://www.linkedin.com/company/plaid-/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQET1PssqfCU5g/company-logo\_400\_400/B4EZarmEzJGYAg-/0/1746635608257/plaid\_\_logo?e=1771459200&v=beta&t=VrlilCOQnXqD5ckAMEQYxMCexYnhPq8nCtoRvMPzXzE"

\[2\]:

id:"4300944614"

title:"Senior Software Engineer - Data Infrastructure"

description:"Making data driven decisions is key to Plaid's culture. To support that, we need to scale our data systems while maintaining correct and complete data. We provide tooling and guidance to teams across engineering, product, and business and help them explore our data quickly and safely to get the data insights they need, which ultimately helps Plaid serve our customers more effectively. We build the data and machine learning infrastructure to enable Plaid engineers to prototype and iterate on products and features built on top of consumer-permissioned financial data.<br>Engineers on Data Infrastructure are domain experts in Data Warehouse, Data Lakehouse, Spark, Workflow Orchestration, and Streaming technologies. We scale our existing data pipelines in a performant and cost efficient way while creating the necessary abstractions to make developing on top of this platform extremely simple for other engineers at Plaid.<br><strong>Responsibilities<br></strong><ul><li>Contribute towards the long-term technical roadmap for data-driven and machine learning iteration at Plaid</li><li>Leading key data infrastructure projects such as improving ML development golden paths, implementing offline streaming solutions for data freshness, building net new ETL pipeline infrastructure, and evolving data warehouse or data lakehouse capabilities.</li><li>Working with stakeholders in other teams and functions to define technical roadmaps for key backend systems and abstractions across Plaid. </li><li>Debugging, troubleshooting, and reducing operational burden for our Data Platform.</li><li>Growing the team via mentorship and leadership, reviewing technical documents and code changes.<br></li></ul><strong>Qualifications<br></strong><ul><li>5+ years of software engineering experience </li><li>Extensive hands-on software engineering experience, with a strong track record of delivering successful projects within the Data Infrastructure or Platform domain at similar or larger companies.</li><li>Deep understanding of one of: ML Infrastructure systems, including Feature Stores, Training Infrastructure, Serving Infrastructure, and Model Monitoring OR Data Infrastructure systems, including Data Warehouses, Data Lakehouses, Apache Spark, Streaming Infrastructure, Workflow Orchestration.</li><li>Strong cross-functional collaboration, communication, and project management skills, with proven ability to coordinate effectively. </li><li>Proficiency in coding, testing, and system design, ensuring reliable and scalable solutions.</li><li>Demonstrated leadership abilities, including experience mentoring and guiding junior engineers.</li><li>\[Nice to have\] Experience with Databricks, Airflow, AWS EMR<br></li></ul>$180,000 - $270,000 a year<br>The target base salary for this position ranges from $180,000/year to $270,000/year in Zone 1. The target base salary will vary based on the job's location.<br><strong>Our Geographic Zones Are As Follows<br></strong>Zone 1 - New York City and San Francisco Bay Area<br>Zone 2 - Los Angeles, Seattle, Washington D.C.<br>Zone 3 - Austin, Boston, Denver, Houston, Portland, Sacramento, San Diego<br>Zone 4 - Raleigh-Durham and all other US cities<br>Additional compensation in the form(s) of equity and/or commission are dependent on the position offered. Plaid provides a comprehensive benefit plan, including medical, dental, vision, and 401(k). Pay is based on factors such as (but not limited to) scope and responsibilities of the position, candidate's work experience and skillset, and location. Pay and benefits are subject to change at any time, consistent with the terms of any applicable compensation or benefit plans."

jobState:"LISTED"

listedAt:1769080509000

workRemoteAllowed:false

workplaceType:"Hybrid"

location:

id:"102277331"

defaultLocalizedName:"San Francisco, California, United States"

abbreviatedLocalizedName:"San Francisco, CA"

company:

id:"2684737"

name:"Plaid"

url:"https://www.linkedin.com/company/plaid-/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQET1PssqfCU5g/company-logo\_400\_400/B4EZarmEzJGYAg-/0/1746635608257/plaid\_\_logo?e=1771459200&v=beta&t=VrlilCOQnXqD5ckAMEQYxMCexYnhPq8nCtoRvMPzXzE"

total:3
