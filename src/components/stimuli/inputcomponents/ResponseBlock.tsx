import { Button, Group, Text } from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { useCallback, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useNextTrialId } from '../../../controllers/utils';
import {
  ResponseLocation,
  SurveyComponent,
  TrialsComponent,
} from '../../../parser/types';
import { useCurrentStep } from '../../../routes/index';
import { useAppDispatch, useStoreActions } from '../../../store';
import {
  updateResponseBlockValidation,
  useAggregateResponses,
  useAreResponsesValid,
  useFlagsDispatch,
} from '../../../store/flags';
import { useNextStep } from '../../../store/hooks/useNextStep';
import { useStudySelector } from '../../../store/index';
import { TrialResult } from '../../../store/types';
import { deepCopy } from '../../../utils/deepCopy';
import { NextButton } from '../../NextButton';
import ResponseSwitcher from './ResponseSwitcher';
import { useAnswerField } from './utils';

type Props = {
  status: TrialResult | null;
  config: TrialsComponent | SurveyComponent;
  location: ResponseLocation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  correctAnswer?: any;
};

function useSavedSurvey() {
  return useStudySelector().survey;
}

export default function ResponseBlock({
  config,
  location,
  correctAnswer = null,
  status = null,
}: Props) {
  const { trialId = null, studyId = null } = useParams<{
    trialId: string;
    studyId: string;
  }>();
  const id = useLocation().pathname;

  console.log('Status', status);

  const isPractice = config.type === 'practice';
  const storedAnswer = status?.answer;

  const responses = config.response.filter(
    (r) =>
      (!r.location && location === 'belowStimulus') || r.location === location
  );

  const isSurvey = config.type === 'survey';
  const savedSurvey = useSavedSurvey();

  const { saveSurvey, saveTrialAnswer } = useStoreActions();
  const appDispatch = useAppDispatch();
  const flagDispatch = useFlagsDispatch();
  const answerValidator = useAnswerField(responses, id);
  const areResponsesValid = useAreResponsesValid(id);
  const aggregateResponses = useAggregateResponses(id);
  const [disableNext, setDisableNext] = useInputState(!storedAnswer);
  const currentStep = useCurrentStep();
  const nextTrialId = useNextTrialId(trialId, config.type);
  const nextStep = useNextStep();

  const showNextBtn =
    location === (config.nextButtonLocation || 'belowStimulus');

  useEffect(() => {
    setDisableNext(!storedAnswer);
  }, [storedAnswer]);

  useEffect(() => {
    console.log('Send', answerValidator.values, answerValidator.isValid());

    flagDispatch(
      updateResponseBlockValidation({
        location,
        trialId: id,
        status: answerValidator.isValid(),
        answers: deepCopy(answerValidator.values),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values]);

  const processNext = useCallback(() => {
    if (config.type === 'survey') {
      const answer = deepCopy(answerValidator.values);

      console.log(answer);

      appDispatch(saveSurvey(answer));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const answer = deepCopy(aggregateResponses!);

      appDispatch(
        saveTrialAnswer({
          trialName: currentStep,
          trialId: trialId || 'NoID',
          answer,
          type: config.type,
        })
      );
    }

    setDisableNext(!disableNext);
  }, [
    aggregateResponses,
    answerValidator.values,
    appDispatch,
    config.type,
    currentStep,
    disableNext,
    saveSurvey,
    saveTrialAnswer,
    setDisableNext,
    trialId,
  ]);

  console.log(answerValidator.values);
  console.log(answerValidator.isValid());

  return (
    <>
      {responses.map((response) => (
        <ResponseSwitcher
          key={`${response.id}-${id}`}
          status={isSurvey ? ({ complete: true } as any) : status}
          storedAnswer={
            isSurvey
              ? (savedSurvey as any)[`${id}/${response.id}`]
              : storedAnswer
              ? (storedAnswer as any)[`${id}/${response.id}`]
              : null
          }
          answer={{
            ...answerValidator.getInputProps(`${id}/${response.id}`, {
              type: response.type === 'checkbox' ? 'checkbox' : 'input',
            }),
          }}
          response={response}
        />
      ))}
      {showNextBtn && isPractice && !disableNext && (
        <Text>The correct answer is: {correctAnswer}</Text>
      )}

      <Group position="right" spacing="xs" mt="xl">
        {correctAnswer && isPractice && (
          <Button
            onClick={setDisableNext}
            disabled={!answerValidator.isValid()}
          >
            Check Answer
          </Button>
        )}
        {showNextBtn && (
          <NextButton
            disabled={
              isSurvey
                ? !savedSurvey && !answerValidator.isValid()
                : isPractice
                ? disableNext
                : !status?.complete && !areResponsesValid
            }
            to={
              nextTrialId
                ? `/${studyId}/${currentStep}/${nextTrialId}`
                : `/${studyId}/${nextStep}`
            }
            process={processNext}
          />
        )}
      </Group>
    </>
  );
}
