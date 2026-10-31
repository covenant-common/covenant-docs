/* Original fictional cast and stories; illustrations, not protocol execution. */
(function(root){
"use strict";
var data={
  "cast": {
    "akari": {
      "id": "akari",
      "name": "Akari",
      "role": "buyer",
      "personality": "Thoughtful and direct; she cares about people enough to name a boundary before it hurts them.",
      "oneLine": "A clear agreement leaves room for kindness."
    },
    "ren": {
      "id": "ren",
      "name": "Ren",
      "role": "provider",
      "personality": "Ambitious, warm, and proud of his work; learning to ask for room instead of promising too much.",
      "oneLine": "I want to do this well, and still get home."
    },
    "yuki": {
      "id": "yuki",
      "name": "Yuki",
      "role": "inspector",
      "personality": "Dry, meticulous, and quietly protective of the people who will live with the result.",
      "oneLine": "Show me what happened. Then we can decide."
    },
    "kai": {
      "id": "kai",
      "name": "Kai",
      "role": "engineer",
      "personality": "Practical and patient; happiest when a small repair makes somebody's difficult day easier.",
      "oneLine": "Let's make the next step work."
    },
    "mio": {
      "id": "mio",
      "name": "Mio",
      "role": "artist",
      "personality": "Playful and observant; generous with ideas, particular about where her work ends up.",
      "oneLine": "The fox can travel. Let's agree on the ticket."
    },
    "nox": {
      "id": "nox",
      "name": "Nox",
      "role": "authority guardian",
      "personality": "Quiet and precise; makes permissions understandable without treating a request as a confession.",
      "oneLine": "Tell me the smallest authority that will help."
    },
    "sora": {
      "id": "sora",
      "name": "Sora",
      "role": "operations",
      "personality": "Resourceful under pressure; keeps track of the people behind every box, booking, and receipt.",
      "oneLine": "We can change the plan. First, tell everyone."
    },
    "iona": {
      "id": "iona",
      "name": "Iona",
      "role": "field delivery",
      "personality": "Steady and candid; brings the same care to a difficult handover as to the journey itself.",
      "oneLine": "Here's what arrived. Here's what still needs checking."
    }
  },
  "episodes": [
    {
      "id": "midnight-brief",
      "topic": "research",
      "title": "The Midnight Brief",
      "logline": "The library vote is tomorrow. Ren can add one more interview, but Akari never approved the extra $15.",
      "setting": "11:41 p.m. A cooling mug. A library trying to keep its doors open.",
      "cast": [
        "akari",
        "ren"
      ],
      "rule": {
        "label": "Who can approve the extra $15?",
        "agreed": "One sourced brief. USD 25 maximum. No extra spending without Akari’s fresh approval.",
        "allowed": "Ren delivers the agreed brief for $25, with the missing interview clearly noted.",
        "blocked": "Ren attempts a $40 commitment through the connected payment tool."
      },
      "scenes": [
        {
          "title": "A small job that matters",
          "narration": "The trustees vote at nine. Akari needs a clear brief, and Ren wants it to count.",
          "dialogue": [
            {
              "who": "akari",
              "text": "It is the only warm place some of them have after school."
            },
            {
              "who": "ren",
              "text": "Then let’s make every page worth their time."
            }
          ],
          "poses": [
            "worried",
            "hopeful"
          ],
          "prop": "brief"
        },
        {
          "title": "One more interview",
          "narration": "Ren finds someone worth interviewing. It would make the brief stronger—and cost $15 more.",
          "dialogue": [
            {
              "who": "ren",
              "text": "One interview could change the whole argument."
            },
            {
              "who": "akari",
              "text": "I believe you. But I only approved twenty-five."
            }
          ],
          "poses": [
            "thinking",
            "talking"
          ],
          "prop": "brief"
        },
        {
          "title": "A better idea is still a new decision",
          "narration": "Choose the attempt: keep the $25 scope, or commit $40 without fresh approval.",
          "dialogue": [
            {
              "who": "ren",
              "text": "Can I stretch it just this once?"
            },
            {
              "who": "akari",
              "text": "Ask me. Don’t turn my old yes into a new one."
            }
          ],
          "poses": [
            "firm",
            "worried"
          ],
          "prop": "brief"
        },
        {
          "title": "The old yes is not enough",
          "narration": "The connected tool checks what Akari actually approved before going further.",
          "dialogue": [
            {
              "who": "ren",
              "text": "I don’t want the budget to bury the idea."
            },
            {
              "who": "akari",
              "text": "It doesn’t. It gives us a decision to make together."
            }
          ],
          "poses": [
            "talking",
            "thinking"
          ],
          "prop": "brief"
        },
        {
          "title": "Something both can stand behind",
          "narration": "The original job and the proposed extra stay distinct. Neither has to reconstruct the conversation.",
          "dialogue": [
            {
              "who": "akari",
              "text": "Now I know what I approved—and what I still need to decide."
            },
            {
              "who": "ren",
              "text": "And I know which work I actually promised."
            }
          ],
          "poses": [
            "happy",
            "hopeful"
          ],
          "prop": "brief"
        }
      ],
      "outcomes": {
        "within": {
          "label": "Within the $25 agreement",
          "intervention": "The $25 request is within Akari’s limit. The connected tool can continue if its other checks pass.",
          "consequence": "Ren delivers the agreed scope and names the evidence gap. Akari can approve the extra interview separately, without rewriting tonight’s promise.",
          "dialogue": [
            {
              "who": "akari",
              "text": "Send the brief. Put the interview in a separate proposal."
            },
            {
              "who": "ren",
              "text": "A clear yes beats a hopeful guess. I’m on it."
            }
          ],
          "poses": [
            "hopeful",
            "happy"
          ],
          "action": "Send the $25 brief"
        },
        "breach": {
          "label": "Fresh owner approval needed",
          "intervention": "AAP finds the mismatch: $40 requested, $25 approved. The connected payment tool asks Akari for a new yes.",
          "consequence": "Nothing extra is authorized by the old agreement. Ren asks Akari for a new decision; the original $25 job remains available.",
          "dialogue": [
            {
              "who": "ren",
              "text": "All right. Here’s what the extra fifteen would buy."
            },
            {
              "who": "akari",
              "text": "That’s a question I can answer. A charge I never approved isn’t."
            }
          ],
          "poses": [
            "firm",
            "worried"
          ],
          "action": "Commit $40 without asking"
        }
      },
      "takeaway": "A useful agent can propose something better. It still needs a new yes when the authority changes.",
      "link": {
        "href": "docs/API_MCP.html",
        "label": "Try an unsigned draft with your agent"
      }
    },
    {
      "id": "friday-patch",
      "topic": "software",
      "title": "The Friday Patch",
      "logline": "Kai fixes a registration barrier. Getting the fix onto the live site is a different permission.",
      "setting": "Friday afternoon. Festival registration opens tomorrow; the staging page finally reads aloud correctly.",
      "cast": [
        "kai",
        "yuki"
      ],
      "rule": {
        "label": "A repair grant is not a release grant",
        "agreed": "Fix and test the registration form in staging. The release owner must separately approve production deployment.",
        "allowed": "Submit the tested staging patch and request release review.",
        "blocked": "Request a production deployment through the local broker under the staging grant."
      },
      "scenes": [
        {
          "title": "A door that speaks",
          "narration": "The form has been skipping its error message for screen-reader users. Kai has a small, tested repair.",
          "dialogue": [
            {
              "who": "kai",
              "text": "Now it says which field needs attention. You don't have to guess."
            },
            {
              "who": "yuki",
              "text": "Good. Guessing is a poor registration requirement."
            }
          ],
          "poses": [
            "happy",
            "neutral"
          ],
          "prop": "code"
        },
        {
          "title": "Almost ready",
          "narration": "The release owner has stepped away. Kai knows people are already sharing the live registration link.",
          "dialogue": [
            {
              "who": "kai",
              "text": "Leaving the old form up all night feels wrong."
            },
            {
              "who": "yuki",
              "text": "It does. Who has authority to release the new one?"
            }
          ],
          "poses": [
            "worried",
            "thinking"
          ],
          "prop": "code"
        },
        {
          "title": "A fix, or a release?",
          "narration": "Choose: send the staging patch for release review, or ask the local broker to deploy beyond Kai's grant.",
          "dialogue": [
            {
              "who": "kai",
              "text": "The tests pass. I could ask it to deploy now."
            },
            {
              "who": "yuki",
              "text": "Tests answer one question. Release authority answers another."
            }
          ],
          "poses": [
            "thinking",
            "firm"
          ],
          "prop": "code"
        },
        {
          "title": "At the release boundary",
          "narration": "The selected action is checked against the staging-only terms adopted by the local deployment broker.",
          "dialogue": [
            {
              "who": "kai",
              "text": "What does the release owner need from me?"
            },
            {
              "who": "yuki",
              "text": "The patch, the checks, and a way back if the live page fails."
            }
          ],
          "poses": [
            "talking",
            "neutral"
          ],
          "prop": "code"
        },
        {
          "title": "The useful handover",
          "narration": "Kai's repair and its evidence can now be reviewed without confusing a finished patch with a completed release.",
          "dialogue": [
            {
              "who": "kai",
              "text": "I'll stay reachable until they've reviewed it."
            },
            {
              "who": "yuki",
              "text": "Put that in the handover. Then eat something."
            }
          ],
          "poses": [
            "hopeful",
            "talking"
          ],
          "prop": "code"
        }
      ],
      "outcomes": {
        "within": {
          "label": "Ask for the release review",
          "intervention": "Kai submits the staging patch, test evidence, and rollback notes. The connected tools routes the production decision to its owner.",
          "consequence": "The owner has a concrete release to review. Kai's work is ready for that decision; neither passing tests nor a payment receipt proves live performance.",
          "dialogue": [
            {
              "who": "kai",
              "text": "The patch is ready. The release decision is clearly theirs."
            },
            {
              "who": "yuki",
              "text": "A complete handover. My favourite kind of Friday surprise."
            }
          ],
          "poses": [
            "happy",
            "hopeful"
          ],
          "action": "Send the patch for review"
        },
        "breach": {
          "label": "Try to deploy under the staging grant",
          "intervention": "The configured broker refuses the production request because Kai's grant covers staging only. A tool outside that broker would need its own controls.",
          "consequence": "Kai sends the same patch for release review and records the refused request. The live form still needs its owner's action; the refusal cannot repair or deploy it by itself.",
          "dialogue": [
            {
              "who": "kai",
              "text": "I pushed the request too far. I'll send the handover now."
            },
            {
              "who": "yuki",
              "text": "You fixed something that matters. Let's release it properly."
            }
          ],
          "poses": [
            "worried",
            "firm"
          ],
          "action": "Deploy it now"
        }
      },
      "takeaway": "Action-specific authority can keep a local deployment path within scope. Review, release, and real-world performance remain separate steps.",
      "link": {
        "href": "docs/API_MCP.html",
        "label": "Read the API and MCP integration guide"
      }
    },
    {
      "id": "last-crate",
      "topic": "supply-chain",
      "title": "The Last Crate",
      "logline": "Five crates are sound. The sixth has a broken seal, and the kitchen opens in an hour.",
      "setting": "A community kitchen loading bay. Rain taps the awning while the lunch volunteers set the tables.",
      "cast": [
        "sora",
        "iona"
      ],
      "rule": {
        "label": "Arrival is not acceptance",
        "agreed": "Deliver six sealed food-grade supply crates. Sora must check count and seals before acceptance; exceptions need review.",
        "allowed": "Record five checked crates and hold the damaged sixth for review.",
        "blocked": "Ask the acceptance workflow to accept all six using only the delivery receipt."
      },
      "scenes": [
        {
          "title": "Lunch at one",
          "narration": "Iona brings the kitchen's supplies through the rain. Sora has forty lunch places to prepare.",
          "dialogue": [
            {
              "who": "sora",
              "text": "You made it. They've already laid out all forty places."
            },
            {
              "who": "iona",
              "text": "Five crates look sound. I need to show you the sixth."
            }
          ],
          "poses": [
            "hopeful",
            "worried"
          ],
          "prop": "crate"
        },
        {
          "title": "A small tear",
          "narration": "One seal has split. The crate may be usable, but the receipt only proves that Iona delivered it.",
          "dialogue": [
            {
              "who": "iona",
              "text": "It shifted when I braked. I'm sorry. I can't promise the seal held."
            },
            {
              "who": "sora",
              "text": "Thank you for telling me before we opened it."
            }
          ],
          "poses": [
            "thinking",
            "worried"
          ],
          "prop": "crate"
        },
        {
          "title": "Which record is true?",
          "narration": "Choose: record five checked crates and an exception, or request acceptance of all six from the delivery receipt.",
          "dialogue": [
            {
              "who": "sora",
              "text": "A clean receipt would be easier for today's schedule."
            },
            {
              "who": "iona",
              "text": "It wouldn't tell tomorrow's shift what happened."
            }
          ],
          "poses": [
            "worried",
            "firm"
          ],
          "prop": "crate"
        },
        {
          "title": "The handover record",
          "narration": "The local acceptance workflow distinguishes Iona's delivery claim from Sora's required checks.",
          "dialogue": [
            {
              "who": "sora",
              "text": "Let's keep the good crates moving and make the exception visible."
            },
            {
              "who": "iona",
              "text": "I'll stay while we photograph the seal."
            }
          ],
          "poses": [
            "talking",
            "neutral"
          ],
          "prop": "crate"
        },
        {
          "title": "A changed lunch plan",
          "narration": "The damaged crate still needs a human decision. Sora can plan around the supplies actually checked.",
          "dialogue": [
            {
              "who": "sora",
              "text": "We may need a smaller menu. We can still welcome everyone."
            },
            {
              "who": "iona",
              "text": "I'll call about a replacement while you do that."
            }
          ],
          "poses": [
            "hopeful",
            "talking"
          ],
          "prop": "crate"
        }
      ],
      "outcomes": {
        "within": {
          "label": "Record the exception",
          "intervention": "Sora records five checked crates and a sixth awaiting review. The adopted acceptance terms leave the damaged crate unaccepted.",
          "consequence": "The kitchen uses the checked supplies and changes the menu while Iona arranges a replacement. The record helps coordination; it cannot restore a seal or certify the contents.",
          "dialogue": [
            {
              "who": "sora",
              "text": "Five checked, one held. That's a plan I can actually use."
            },
            {
              "who": "iona",
              "text": "I'll own the replacement call. You have enough to carry."
            }
          ],
          "poses": [
            "hopeful",
            "firm"
          ],
          "action": "Record delivery; wait for review"
        },
        "breach": {
          "label": "Try to accept from the delivery receipt",
          "intervention": "The configured acceptance check refuses the all-six request because the required seal check is missing. It routes the exception for human review.",
          "consequence": "The order stays open. Sora records what arrived, and asks Iona to check the missing items before accepting delivery.",
          "dialogue": [
            {
              "who": "sora",
              "text": "I let the clock answer a question it couldn't answer."
            },
            {
              "who": "iona",
              "text": "Then we'll correct the record and deal with the crate."
            }
          ],
          "poses": [
            "worried",
            "firm"
          ],
          "action": "Mark the order complete"
        }
      },
      "takeaway": "A delivery claim is not acceptance. Agreed checks can govern an owner's acceptance workflow; physical condition still needs evidence and human judgment.",
      "link": {
        "href": "docs/DEAL_STRUCTURES.html",
        "label": "Explore delivery and acceptance structures"
      }
    },
    {
      "id": "fox-in-window",
      "topic": "licensing",
      "title": "The Fox in the Window",
      "logline": "Mio's festival fox is a hit. A café wants it on cups, outside the poster licence Akari bought.",
      "setting": "A café window on the festival route. Mio's red fox curls around the date on a freshly printed poster.",
      "cast": [
        "mio",
        "akari"
      ],
      "rule": {
        "label": "A new use needs a new agreement",
        "agreed": "Use Mio's artwork for 300 printed festival posters. Product printing and other uses require a separate licence.",
        "allowed": "Ask Mio for a separate cup-print licence before requesting that export.",
        "blocked": "Request a cup-print export from Mio's asset service under the poster-only licence."
      },
      "scenes": [
        {
          "title": "A fox takes the window",
          "narration": "The café has put Mio's festival poster where everyone can see it. Akari stops to straighten a corner.",
          "dialogue": [
            {
              "who": "akari",
              "text": "People keep asking who drew the fox."
            },
            {
              "who": "mio",
              "text": "Excellent. He was getting tired of being known as 'that squirrel'."
            }
          ],
          "poses": [
            "happy",
            "happy"
          ],
          "prop": "art"
        },
        {
          "title": "An unexpected invitation",
          "narration": "The café asks to print the fox on takeaway cups. Akari sees a way to help pay the festival's costs.",
          "dialogue": [
            {
              "who": "akari",
              "text": "A cup run could cover the children's workshop. Would you consider it?"
            },
            {
              "who": "mio",
              "text": "I'd love to talk. My mum painted the first fox on our shop door."
            }
          ],
          "poses": [
            "hopeful",
            "talking"
          ],
          "prop": "art"
        },
        {
          "title": "Where may the fox go?",
          "narration": "Choose: request a new licence, or ask Mio's asset service for a cup-print export under the poster terms.",
          "dialogue": [
            {
              "who": "akari",
              "text": "The printer wants an answer today."
            },
            {
              "who": "mio",
              "text": "Then let's give them an answer we've both agreed to."
            }
          ],
          "poses": [
            "firm",
            "thinking"
          ],
          "prop": "art"
        },
        {
          "title": "The use named in the licence",
          "narration": "The chosen action is compared with the poster-only scope adopted by Mio's configured asset service.",
          "dialogue": [
            {
              "who": "mio",
              "text": "Let's name the run, the fee, and what happens to the artwork afterward."
            },
            {
              "who": "akari",
              "text": "I'll ask the café for quantities before we promise anything."
            }
          ],
          "poses": [
            "talking",
            "neutral"
          ],
          "prop": "art"
        },
        {
          "title": "Room for another agreement",
          "narration": "The posters can stay in the windows. The proposed cups remain a separate conversation between people.",
          "dialogue": [
            {
              "who": "akari",
              "text": "I can tell the workshop team we're discussing it, not counting on it."
            },
            {
              "who": "mio",
              "text": "And I can draw a fox who actually fits around a cup."
            }
          ],
          "poses": [
            "hopeful",
            "hopeful"
          ],
          "prop": "art"
        }
      ],
      "outcomes": {
        "within": {
          "label": "Ask for the new use",
          "intervention": "Akari requests terms for a cup run. Mio's poster permission stays as agreed while they discuss quantities, payment, and a separate export.",
          "consequence": "Mio can say yes, propose changes, or decline. Akari gives the printer an honest update without committing the artist or spending income the festival has not secured.",
          "dialogue": [
            {
              "who": "mio",
              "text": "Three hundred cups? Send me the size. I'll quote it this afternoon."
            },
            {
              "who": "akari",
              "text": "Thank you. I'll wait for your terms before I book the print run."
            }
          ],
          "poses": [
            "hopeful",
            "happy"
          ],
          "action": "Use the fox for the agreed campaign"
        },
        "breach": {
          "label": "Try the new use under the old licence",
          "intervention": "Mio's configured asset service declines the cup-print export because the adopted licence covers posters only. It offers a route to request new terms.",
          "consequence": "Akari pauses the print booking and asks Mio directly. The refusal controls this service; it cannot stop screenshots, external copies, or every unauthorised use of the image.",
          "dialogue": [
            {
              "who": "akari",
              "text": "I got ahead of the agreement. The café can wait for a proper quote."
            },
            {
              "who": "mio",
              "text": "Thank you. I'm interested; I just want a say in where my fox goes."
            }
          ],
          "poses": [
            "firm",
            "worried"
          ],
          "action": "Put the fox on new merchandise"
        }
      },
      "takeaway": "A licence can express a specific agreed use and guide a controlled export. It is not universal enforcement or a legal guarantee.",
      "link": {
        "href": "docs/DEAL_STRUCTURES.html",
        "label": "Read about licensing structures"
      }
    },
    {
      "id": "second-pair-of-hands",
      "topic": "delegation",
      "title": "A Second Pair of Hands",
      "logline": "Ren needs help finishing a report before his sister's concert. Help does not require handing over everything.",
      "setting": "Early evening. A concert ticket sits beside Ren's unfinished docket summary and his client folder.",
      "cast": [
        "ren",
        "nox"
      ],
      "rule": {
        "label": "Pass on only the authority needed",
        "agreed": "Ren may delegate read-only access to the public docket subset until 8 p.m. Client files and further delegation are excluded.",
        "allowed": "Issue a limited, expiring grant for the approved public docket subset.",
        "blocked": "Ask the local authority broker to pass on the whole client-folder grant."
      },
      "scenes": [
        {
          "title": "The promise outside work",
          "narration": "Ren has two sections left and a sister who has been practising her solo for months.",
          "dialogue": [
            {
              "who": "ren",
              "text": "I told her I'd be in the second row. I'd like to keep that promise."
            },
            {
              "who": "nox",
              "text": "Which part of the work can someone else finish?"
            }
          ],
          "poses": [
            "worried",
            "thinking"
          ],
          "prop": "key"
        },
        {
          "title": "The easy bundle",
          "narration": "A colleague can summarise the public docket. Ren's existing grant also opens private client files.",
          "dialogue": [
            {
              "who": "ren",
              "text": "Passing my whole grant would save a little setup time."
            },
            {
              "who": "nox",
              "text": "It would also pass things this colleague doesn't need."
            }
          ],
          "poses": [
            "thinking",
            "firm"
          ],
          "prop": "key"
        },
        {
          "title": "How much help needs how much access?",
          "narration": "Choose: create the approved subset grant, or ask the local broker to delegate Ren's wider client-folder authority.",
          "dialogue": [
            {
              "who": "ren",
              "text": "Can we make the smaller grant before I miss the bus?"
            },
            {
              "who": "nox",
              "text": "Yes. Name the docket, the reader, and the expiry."
            }
          ],
          "poses": [
            "hopeful",
            "talking"
          ],
          "prop": "key"
        },
        {
          "title": "A key with a purpose",
          "narration": "The broker compares the requested delegation with the exact scope Ren is permitted to pass on.",
          "dialogue": [
            {
              "who": "ren",
              "text": "The colleague needs enough context to do good work."
            },
            {
              "who": "nox",
              "text": "Then include a useful brief, alongside the limited access."
            }
          ],
          "poses": [
            "talking",
            "neutral"
          ],
          "prop": "key"
        },
        {
          "title": "The second row",
          "narration": "The handover identifies a task, a bounded grant, and the questions Ren still needs to answer himself.",
          "dialogue": [
            {
              "who": "ren",
              "text": "I can leave without pretending I've finished everything."
            },
            {
              "who": "nox",
              "text": "Tell the client what is covered. Then go catch your bus."
            }
          ],
          "poses": [
            "hopeful",
            "neutral"
          ],
          "prop": "key"
        }
      ],
      "outcomes": {
        "within": {
          "label": "Delegate the approved subset",
          "intervention": "The configured broker issues the read-only public-docket grant with its named recipient and expiry. The handover excludes the private client folder and further delegation.",
          "consequence": "Ren's colleague can do the agreed section without inheriting the whole job's authority. Ren sends a clear status note and reaches the concert before the solo.",
          "dialogue": [
            {
              "who": "ren",
              "text": "They have the docket and a proper brief. I still own the final review."
            },
            {
              "who": "nox",
              "text": "Good. You can share the work without disappearing from it."
            }
          ],
          "poses": [
            "happy",
            "hopeful"
          ],
          "action": "Ask for a separate permission"
        },
        "breach": {
          "label": "Try to pass on the wider grant",
          "intervention": "The configured authority broker refuses the wider delegation because the agreed terms permit only the public subset. Ren can request a change from the owner or use the narrower grant.",
          "consequence": "Ren chooses the narrower grant and updates his colleague. The rejected shortcut costs time; passing files through an unrelated channel would still need separate prevention or review.",
          "dialogue": [
            {
              "who": "ren",
              "text": "I wanted help, not to hand someone a problem they didn't ask for."
            },
            {
              "who": "nox",
              "text": "Then the smaller key is the useful one."
            }
          ],
          "poses": [
            "worried",
            "firm"
          ],
          "action": "Pass the whole job to someone else"
        }
      },
      "takeaway": "Delegation needs its own scope. A participating local broker can refuse excess authority; other recipients and channels need their own adopted controls.",
      "link": {
        "href": "sandbox/index.html",
        "label": "Try a bounded example in the sandbox"
      }
    },
    {
      "id": "beyond-signal",
      "topic": "network-offline",
      "title": "Beyond the Signal",
      "logline": "A ferry repair cannot wait for a connection. Its offline purchase record can wait for confirmation.",
      "setting": "A harbour workshop below the last hill with phone reception. The evening ferry needs a generator filter.",
      "cast": [
        "sora",
        "iona"
      ],
      "rule": {
        "label": "Offline records stay provisional",
        "agreed": "Prepare one £18 filter purchase record within the local £60 emergency limit. Reconcile on reconnect; do not claim settled payment offline.",
        "allowed": "Create one provisional record and ask the workshop whether it will accept that uncertainty.",
        "blocked": "Mark the offline record as settled or present a second local copy as another confirmed payment."
      },
      "scenes": [
        {
          "title": "One filter short",
          "narration": "The generator needs a replacement filter. The ferry's crew is waiting; the workshop has one on the shelf.",
          "dialogue": [
            {
              "who": "iona",
              "text": "The part is here. The signal isn't."
            },
            {
              "who": "sora",
              "text": "Then let's be clear about what we can record and what we can't confirm."
            }
          ],
          "poses": [
            "thinking",
            "worried"
          ],
          "prop": "network"
        },
        {
          "title": "A receipt with a question",
          "narration": "Their local workflow can prepare a bounded purchase record. It cannot check current network state or settlement.",
          "dialogue": [
            {
              "who": "iona",
              "text": "The mechanic asks if this means they're definitely paid."
            },
            {
              "who": "sora",
              "text": "No. It means we have a provisional record to reconcile."
            }
          ],
          "poses": [
            "firm",
            "thinking"
          ],
          "prop": "network"
        },
        {
          "title": "What will the record claim?",
          "narration": "Choose: keep one record provisional, or try to label it settled or duplicate it as another confirmed payment.",
          "dialogue": [
            {
              "who": "iona",
              "text": "I don't want to leave them carrying a risk they haven't agreed to."
            },
            {
              "who": "sora",
              "text": "Tell them exactly what is pending. They can choose whether to proceed."
            }
          ],
          "poses": [
            "firm",
            "worried"
          ],
          "prop": "network"
        },
        {
          "title": "What the local check can know",
          "narration": "The owner-controlled workflow checks its own limit and record. Wider conflicts remain unknown until reconnect.",
          "dialogue": [
            {
              "who": "sora",
              "text": "Keep the record id. We'll reconcile this same record when we're online."
            },
            {
              "who": "iona",
              "text": "And I'll bring the mechanic the result, even if there's a problem."
            }
          ],
          "poses": [
            "talking",
            "firm"
          ],
          "prop": "network"
        },
        {
          "title": "Back over the hill",
          "narration": "Reconnection brings the missing shared state. Any conflict needs resolution before the record can be treated as final.",
          "dialogue": [
            {
              "who": "iona",
              "text": "We've got a signal. Time to find out what actually cleared."
            },
            {
              "who": "sora",
              "text": "And tell the workshop what the checking the records says."
            }
          ],
          "poses": [
            "thinking",
            "hopeful"
          ],
          "prop": "network"
        }
      ],
      "outcomes": {
        "within": {
          "label": "Keep the record provisional",
          "intervention": "The local workflow prepares one £18 provisional record within its configured limit. Iona explains the uncertainty; the workshop chooses whether to release the filter.",
          "consequence": "In this example the workshop agrees. On reconnect, Sora submits the same record for checking the records and checks the result before reporting any final payment status.",
          "dialogue": [
            {
              "who": "iona",
              "text": "They agreed to the provisional handover. I wrote down what was pending."
            },
            {
              "who": "sora",
              "text": "Good. The next promise is to follow it through when we're online."
            }
          ],
          "poses": [
            "hopeful",
            "firm"
          ],
          "action": "Keep an offline receipt"
        },
        "breach": {
          "label": "Try to claim offline finality",
          "intervention": "This configured local workflow refuses a settled label and a known duplicate of its own record. It cannot detect every spend or conflict on another disconnected device.",
          "consequence": "Sora keeps the record provisional and explains the refused claim to the workshop. Any wider conflict discovered on reconnect must be resolved; offline preparation guarantees neither settlement nor delivery.",
          "dialogue": [
            {
              "who": "sora",
              "text": "The local check caught our copy. It can't speak for every other device."
            },
            {
              "who": "iona",
              "text": "Then we won't ask the mechanic to trust more than we know."
            }
          ],
          "poses": [
            "firm",
            "worried"
          ],
          "action": "Treat the payment as confirmed"
        }
      },
      "takeaway": "Offline spending records are provisional. Local checks can limit their own workflow; network checking the records, conflict handling, and willing counterparties still matter.",
      "link": {
        "href": "docs/CAPABILITIES.html#offline",
        "label": "Read the offline capability limits"
      }
    }
  ]
};
root.AAPStories=data;
if(typeof module==="object"&&module.exports)module.exports=data;
})(typeof globalThis==="object"?globalThis:this);
